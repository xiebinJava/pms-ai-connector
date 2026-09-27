import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getRegistry } from "@jackwener/opencli/registry";
import { z } from "zod";
import {
  capabilityCatalogSchema,
  queryResultSchema,
  resourceTypeSchema,
  type ResourceRef,
  type CapabilityCatalog,
  type QueryResult,
  type ResourceType,
  type WorkflowContext,
  workflowResourceTypeSchema,
} from "../../packages/pms-contracts/src/index.js";
import {
  PmsHttpClient,
  StaticTokenProvider,
  type PmsClient,
} from "../../packages/pms-client/src/index.js";
import { createPmsToolHandlers } from "../../apps/mcp-server/src/tools/index.js";
import {
  resetPmsClientFactory,
  setPmsClientFactoryForTests,
} from "../../apps/opencli-plugin/runtime.js";

import "../../apps/opencli-plugin/capabilities.js";
import "../../apps/opencli-plugin/search.js";
import "../../apps/opencli-plugin/get.js";
import "../../apps/opencli-plugin/execute.js";

export type ScenarioAdapter = "mcp" | "opencli";

export interface ScenarioStep {
  operation: string;
  adapter?: ScenarioAdapter;
  whenCapture?: string;
  arguments?: Record<string, unknown>;
  context?: { id: unknown; version: unknown };
  contract?: { id: unknown; version: unknown };
  idempotencyKey?: string;
  requestId?: string;
  capture?: Record<string, string>;
}

export interface QueryAssertion {
  resourceType: ResourceType;
  keyword?: string;
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
}

export interface InvalidRelationCase extends ScenarioStep {
  expectedKind: string;
}

export interface ConcurrencyScenario {
  setup?: ScenarioStep[];
  steps: [ScenarioStep, ScenarioStep];
  expectedKind?: string;
}

export interface AdapterConsistencyScenario {
  mcp: ScenarioStep;
  opencli: ScenarioStep;
}

export interface E2eScenario {
  steps: ScenarioStep[];
  cleanup?: ScenarioStep[];
  assertions?: QueryAssertion[];
  invalidRelations?: InvalidRelationCase[];
  idempotency?: ScenarioStep;
  concurrency?: ConcurrencyScenario;
  adapterConsistency?: AdapterConsistencyScenario;
}

export interface AdapterCapabilities {
  mcp: CapabilityCatalog;
  opencli: CapabilityCatalog;
}

export interface AdapterQueryResult {
  mcp: QueryResult;
  opencli: QueryResult;
}

export interface AdapterContextResult {
  mcp: WorkflowContext;
  opencli: WorkflowContext;
}

export interface InvalidRelationResult {
  adapter: ScenarioAdapter;
  expectedKind: string;
  error: Record<string, unknown>;
}

export interface RepeatedExecutionResult {
  first: Record<string, unknown>;
  second: Record<string, unknown>;
  captures: Record<string, unknown>;
}

export interface ConcurrentExecutionOutcome {
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export interface ConcurrentExecutionResult {
  outcomes: ConcurrentExecutionOutcome[];
  captures: Record<string, unknown>;
}

export interface AdapterConsistencyResult {
  mcp: Record<string, unknown>;
  opencli: Record<string, unknown>;
  captures: Record<string, unknown>;
}

export class ScenarioAdapterError extends Error {
  constructor(readonly error: Record<string, unknown>) {
    super(String(error.message ?? "PMS 场景执行失败"));
    this.name = "ScenarioAdapterError";
  }
}

export class ScenarioExecutionError extends Error {
  constructor(
    readonly cause: unknown,
    readonly captures: Record<string, unknown>,
  ) {
    super(cause instanceof Error ? cause.message : "PMS 场景执行失败");
    this.name = "ScenarioExecutionError";
  }
}

export function capturesFromScenarioError(error: unknown): Record<string, unknown> | undefined {
  return error instanceof ScenarioExecutionError ? error.captures : undefined;
}

export function e2eEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PMS_E2E_WRITE === "true"
    && Boolean(env.PMS_E2E_BASE_URL)
    && Boolean(env.PMS_E2E_TOKEN)
    && Boolean(env.PMS_E2E_SCENARIO_FILE);
}

export function readOnlyE2eEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PMS_E2E_READONLY === "true"
    && Boolean(env.PMS_E2E_BASE_URL)
    && Boolean(env.PMS_E2E_TOKEN);
}

export async function loadScenario(
  env: Record<string, string | undefined> = process.env,
): Promise<E2eScenario> {
  const file = env.PMS_E2E_SCENARIO_FILE;
  if (!file) throw new Error("PMS_E2E_SCENARIO_FILE 未配置");

  const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!isRecord(parsed) || !Array.isArray(parsed.steps)) {
    throw new Error("E2E 场景文件必须包含 steps 数组");
  }
  const cleanup = Array.isArray(parsed.cleanup)
    ? parsed.cleanup.map((step, index) => parseScenarioStep(step, `cleanup[${index}]`))
    : undefined;
  if (env.PMS_E2E_WRITE === "true" && (!cleanup || cleanup.length === 0)) {
    throw new Error("PMS_E2E_WRITE=true 的 E2E 场景必须包含至少一个 cleanup 步骤");
  }
  return {
    steps: parsed.steps.map((step, index) => parseScenarioStep(step, `steps[${index}]`)),
    cleanup,
    assertions: Array.isArray(parsed.assertions)
      ? parsed.assertions.map((assertion, index) => parseQueryAssertion(assertion, `assertions[${index}]`))
      : undefined,
    invalidRelations: Array.isArray(parsed.invalidRelations)
      ? parsed.invalidRelations.map((item, index) => parseInvalidRelation(item, `invalidRelations[${index}]`))
      : undefined,
    idempotency: parsed.idempotency === undefined
      ? undefined
      : parseScenarioStep(parsed.idempotency, "idempotency"),
    concurrency: parsed.concurrency === undefined
      ? undefined
      : parseConcurrencyScenario(parsed.concurrency),
    adapterConsistency: parsed.adapterConsistency === undefined
      ? undefined
      : parseAdapterConsistencyScenario(parsed.adapterConsistency),
  };
}

export async function runCapabilitiesThroughAdapters(
  env: Record<string, string | undefined> = process.env,
): Promise<AdapterCapabilities> {
  const mcpClient = createClient(env, "mcp");
  const opencliClient = createClient(env, "opencli");
  const mcpHandlers = createPmsToolHandlers(mcpClient, {
    clientId: "mcp",
    requestIdFactory: randomUUID,
  });
  const mcpResult = await mcpHandlers.pms_capabilities();
  const mcp = parseMcpSuccess(mcpResult, capabilityCatalogSchema, "pms_capabilities");
  const opencli = capabilityCatalogSchema.parse(await runOpenCliCommand("capabilities", {}, opencliClient));
  return { mcp, opencli };
}

export async function runScenarioSteps(
  steps: ScenarioStep[],
  env: Record<string, string | undefined> = process.env,
  initialCaptures: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const capabilities = await runCapabilitiesThroughAdapters(env);
  const operations = operationNames(capabilities.mcp);
  for (const step of steps) {
    if (!operations.has(step.operation)) {
      throw new Error(`E2E 场景使用了当前能力目录不存在的操作: ${step.operation}`);
    }
  }

  const captures: Record<string, unknown> = {
    ...initialCaptures,
    runId: initialCaptures.runId ?? randomUUID(),
  };
  try {
    for (const [index, step] of steps.entries()) {
      const result = await executeScenarioStep(step, captures, index, env);
      applyCaptures(captures, step.capture, result);
    }
  } catch (error) {
    throw new ScenarioExecutionError(error, captures);
  }
  return captures;
}

export async function cleanupScenarioSteps(
  cleanup: ScenarioStep[],
  captures: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  if (!cleanup.length) return;
  const capabilities = await runCapabilitiesThroughAdapters(env);
  const operations = operationNames(capabilities.mcp);
  for (const step of cleanup) {
    if (!operations.has(step.operation)) {
      throw new Error(`E2E 清理场景使用了当前能力目录不存在的操作: ${step.operation}`);
    }
  }
  for (const [index, step] of cleanup.entries()) {
    if (step.whenCapture && captures[step.whenCapture] === undefined) continue;
    const result = await executeScenarioStep(step, captures, index, env);
    applyCaptures(captures, step.capture, result);
  }
}

export async function runQueryThroughAdapters(
  assertion: QueryAssertion,
  captures: Record<string, unknown> = {},
  env: Record<string, string | undefined> = process.env,
): Promise<AdapterQueryResult> {
  const resolved = resolveValue(assertion, captures) as QueryAssertion;
  const input = {
    resourceType: resolved.resourceType,
    ...(resolved.keyword === undefined ? {} : { keyword: resolved.keyword }),
    filters: resolved.filters ?? {},
    page: resolved.page ?? 1,
    pageSize: resolved.pageSize ?? 20,
  };

  const mcpClient = createClient(env, "mcp");
  const mcpHandlers = createPmsToolHandlers(mcpClient, {
    clientId: "mcp",
    requestIdFactory: randomUUID,
  });
  const mcpResult = await mcpHandlers.pms_search(input);
  const mcp = parseMcpSuccess(mcpResult, queryResultSchema, "pms_search");
  const opencli = queryResultSchema.parse(await runOpenCliCommand("search", {
    resourceType: input.resourceType,
    ...(input.keyword === undefined ? {} : { keyword: input.keyword }),
    filtersJson: JSON.stringify(input.filters),
    page: input.page,
    pageSize: input.pageSize,
  }, createClient(env, "opencli")));
  return { mcp, opencli };
}

export async function runContextThroughAdapters(
  resource: ResourceRef,
  env: Record<string, string | undefined> = process.env,
): Promise<AdapterContextResult> {
  const mcpHandlers = createPmsToolHandlers(createClient(env, "mcp"), {
    clientId: "mcp",
    requestIdFactory: randomUUID,
  });
  const mcpResult = await mcpHandlers.pms_get_context({
    resourceType: resource.type,
    resourceId: resource.id,
  });
  const mcp = parseMcpSuccess(mcpResult, workflowContextSchema, "pms_get_context");
  const opencli = workflowContextSchema.parse(await runOpenCliCommand("get", {
    resourceType: resource.type,
    resourceId: resource.id,
  }, createClient(env, "opencli")));
  return { mcp, opencli };
}

export async function runInvalidRelationCases(
  cases: InvalidRelationCase[],
  env: Record<string, string | undefined> = process.env,
): Promise<InvalidRelationResult[]> {
  const results: InvalidRelationResult[] = [];
  for (const [index, item] of cases.entries()) {
    const adapters: ScenarioAdapter[] = item.adapter ? [item.adapter] : ["mcp"];
    for (const adapter of adapters) {
      const captures: Record<string, unknown> = { runId: randomUUID() };
      try {
        await executeScenarioStep({ ...item, adapter }, captures, index, env);
        throw new Error(`E2E 场景预期 PMS 拒绝操作，但操作成功: ${item.operation}`);
      } catch (error) {
        if (!(error instanceof ScenarioAdapterError)) throw error;
        results.push({ adapter, expectedKind: item.expectedKind, error: error.error });
      }
    }
  }
  return results;
}

export async function runIdempotencyCheck(
  step: ScenarioStep,
  env: Record<string, string | undefined> = process.env,
  initialCaptures: Record<string, unknown> = {},
): Promise<RepeatedExecutionResult> {
  const captures: Record<string, unknown> = {
    ...initialCaptures,
    runId: initialCaptures.runId ?? randomUUID(),
  };
  try {
    const first = await executeScenarioStep(step, captures, 0, env);
    applyCaptures(captures, step.capture, first);
    const second = await executeScenarioStep(step, captures, 0, env);
    return { first, second, captures };
  } catch (error) {
    throw new ScenarioExecutionError(error, captures);
  }
}

export async function runConcurrentSteps(
  steps: [ScenarioStep, ScenarioStep],
  env: Record<string, string | undefined> = process.env,
  initialCaptures: Record<string, unknown> = {},
): Promise<ConcurrentExecutionResult> {
  const captures: Record<string, unknown> = {
    ...initialCaptures,
    runId: initialCaptures.runId ?? randomUUID(),
  };
  try {
    const outcomes = await Promise.all(steps.map(async (step, index) => {
      try {
        const result = await executeScenarioStep(step, captures, index, env);
        return { result };
      } catch (error) {
        if (error instanceof ScenarioAdapterError) return { error: error.error };
        throw error;
      }
    }));
    return { outcomes, captures };
  } catch (error) {
    throw new ScenarioExecutionError(error, captures);
  }
}

export async function runAdapterConsistencyCheck(
  scenario: AdapterConsistencyScenario,
  env: Record<string, string | undefined> = process.env,
  initialCaptures: Record<string, unknown> = {},
): Promise<AdapterConsistencyResult> {
  const captures: Record<string, unknown> = {
    ...initialCaptures,
    runId: initialCaptures.runId ?? randomUUID(),
  };
  try {
    const mcp = await executeScenarioStep({ ...scenario.mcp, adapter: "mcp" }, captures, 0, env);
    applyCaptures(captures, scenario.mcp.capture, mcp);
    const opencli = await executeScenarioStep({ ...scenario.opencli, adapter: "opencli" }, captures, 1, env);
    applyCaptures(captures, scenario.opencli.capture, opencli);
    return { mcp, opencli, captures };
  } catch (error) {
    throw new ScenarioExecutionError(error, captures);
  }
}

function createClient(
  env: Record<string, string | undefined>,
  clientId: "mcp" | "opencli",
): PmsClient {
  const baseUrl = env.PMS_E2E_BASE_URL;
  const token = env.PMS_E2E_TOKEN;
  if (!baseUrl || !token) throw new Error("PMS_E2E_BASE_URL 和 PMS_E2E_TOKEN 必须同时配置");
  return new PmsHttpClient({
    baseUrl,
    auth: new StaticTokenProvider(token),
    clientId,
  });
}

async function executeScenarioStep(
  step: ScenarioStep,
  captures: Record<string, unknown>,
  index: number,
  env: Record<string, string | undefined>,
): Promise<Record<string, unknown>> {
  const resolved = resolveValue(step, captures) as ScenarioStep;
  const adapter = resolved.adapter ?? "mcp";
  const idempotencyKey = resolved.idempotencyKey
    ?? `pms-e2e-${String(captures.runId)}-${index}-${resolved.operation}`;
  const requestId = resolved.requestId ?? `pms-e2e-request-${String(captures.runId)}-${index}`;
  const input = {
    operation: resolved.operation,
    arguments: resolved.arguments ?? {},
    ...(resolved.context ? { context: {
      id: String(resolved.context.id),
      version: String(resolved.context.version),
    } } : {}),
    ...(resolved.contract ? { contract: {
      id: String(resolved.contract.id),
      version: String(resolved.contract.version),
    } } : {}),
    idempotencyKey,
    requestId,
  };

  if (adapter === "mcp") {
    const handlers = createPmsToolHandlers(createClient(env, "mcp"), {
      clientId: "mcp",
      requestIdFactory: randomUUID,
    });
    const result = await handlers.pms_execute_operation(input);
    return parseMcpExecuteResult(result);
  }

  try {
    return (await runOpenCliCommand("execute", {
      operation: input.operation,
      argumentsJson: JSON.stringify(input.arguments),
      ...(input.context ? {
        contextId: input.context.id,
        contextVersion: input.context.version,
      } : {}),
      ...(input.contract ? {
        contractId: input.contract.id,
        contractVersion: input.contract.version,
      } : {}),
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
    }, createClient(env, "opencli"))) as Record<string, unknown>;
  } catch (error) {
    throw new ScenarioAdapterError(parseOpenCliError(error));
  }
}

async function runOpenCliCommand(
  name: string,
  input: Record<string, unknown>,
  client: PmsClient,
): Promise<unknown> {
  const registered = getRegistry().get(`pms/${name}`);
  if (!registered?.func || registered.browser !== false) {
    throw new Error(`pms/${name} 不是可调用的本地 OpenCLI 命令`);
  }
  setPmsClientFactoryForTests(() => client);
  try {
    const result = await registered.func(input);
    if (!Array.isArray(result) || result.length !== 1) {
      throw new Error(`pms/${name} 返回了异常结果`);
    }
    return result[0];
  } finally {
    resetPmsClientFactory();
  }
}

function parseMcpSuccess<T>(
  result: { isError?: boolean; structuredContent?: unknown },
  schema: { parse: (value: unknown) => T },
  name: string,
): T {
  if (result.isError || !result.structuredContent) {
    throw new ScenarioAdapterError(readMcpError(result));
  }
  try {
    return schema.parse(result.structuredContent);
  } catch {
    throw new Error(`${name} 返回了不符合契约的结构`);
  }
}

const workflowContextSchema = z.object({
  resource: z.object({
    type: workflowResourceTypeSchema,
    id: z.number().int().positive(),
  }),
  version: z.number().int().nonnegative().nullable(),
  currentNode: z.object({
    id: z.number().int().positive().nullable(),
    key: z.string().min(1),
    label: z.string().min(1),
  }).optional(),
  workflow: z.object({
    templateVersionId: z.number().int().positive().optional(),
    nodes: z.array(z.unknown()),
  }).optional(),
  allowedActions: z.array(z.string()),
});

function parseMcpExecuteResult(result: {
  isError?: boolean;
  structuredContent?: unknown;
}): Record<string, unknown> {
  if (result.isError || !result.structuredContent) {
    throw new ScenarioAdapterError(readMcpError(result));
  }
  if (!isRecord(result.structuredContent)) throw new Error("pms_execute_operation 返回结构无效");
  return result.structuredContent;
}

function readMcpError(result: { structuredContent?: unknown }): Record<string, unknown> {
  if (isRecord(result.structuredContent) && isRecord(result.structuredContent.error)) {
    return result.structuredContent.error;
  }
  return { kind: "internal", message: "MCP 返回了无效错误结构" };
}

function parseOpenCliError(error: unknown): Record<string, unknown> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const parsed: unknown = JSON.parse(message);
    if (isRecord(parsed) && isRecord(parsed.error)) return parsed.error;
  } catch {
    // OpenCLI may throw a non-JSON validation error; keep the adapter contract stable.
  }
  return { kind: "internal", message: "OpenCLI 命令执行失败" };
}

function operationNames(catalog: CapabilityCatalog): Set<string> {
  const names = new Set<string>();
  for (const resource of catalog.resources) {
    for (const action of resource.actions) names.add(action.name);
    for (const node of resource.workflow?.nodes ?? []) {
      for (const component of node.components) {
        for (const action of component.actions) names.add(action);
      }
    }
  }
  return names;
}

function applyCaptures(
  captures: Record<string, unknown>,
  captureMap: Record<string, string> | undefined,
  value: Record<string, unknown>,
): void {
  for (const [name, path] of Object.entries(captureMap ?? {})) {
    const captured = readPath(value, path);
    if (captured === undefined) throw new Error(`场景捕获字段不存在: ${path}`);
    captures[name] = captured;
  }
}

function resolveValue(value: unknown, captures: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{([^}]+)}}$/);
    if (exact) return readPath(captures, exact[1].trim());
    return value.replace(/\{\{([^}]+)}}/g, (_match, path: string) => String(readPath(captures, path.trim()) ?? ""));
  }
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, captures));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValue(item, captures)]));
  }
  return value;
}

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, value);
}

function parseScenarioStep(value: unknown, path: string): ScenarioStep {
  if (!isRecord(value) || typeof value.operation !== "string" || !value.operation.trim()) {
    throw new Error(`${path}.operation 必须是非空字符串`);
  }
  if (value.adapter !== undefined && value.adapter !== "mcp" && value.adapter !== "opencli") {
    throw new Error(`${path}.adapter 只能是 mcp 或 opencli`);
  }
  if (value.whenCapture !== undefined && typeof value.whenCapture !== "string") {
    throw new Error(`${path}.whenCapture 必须是字符串`);
  }
  if (value.arguments !== undefined && (!isRecord(value.arguments) || Array.isArray(value.arguments))) {
    throw new Error(`${path}.arguments 必须是对象`);
  }
  return value as unknown as ScenarioStep;
}

function parseInvalidRelation(value: unknown, path: string): InvalidRelationCase {
  const step = parseScenarioStep(value, path);
  if (!isRecord(value) || typeof value.expectedKind !== "string" || !value.expectedKind.trim()) {
    throw new Error(`${path}.expectedKind 必须是非空字符串`);
  }
  return { ...step, expectedKind: value.expectedKind };
}

function parseConcurrencyScenario(value: unknown): ConcurrencyScenario {
  if (!isRecord(value) || !Array.isArray(value.steps) || value.steps.length !== 2) {
    throw new Error("concurrency.steps 必须包含两个场景步骤");
  }
  const setup = Array.isArray(value.setup)
    ? value.setup.map((step, index) => parseScenarioStep(step, `concurrency.setup[${index}]`))
    : undefined;
  const steps = value.steps.map((step, index) => parseScenarioStep(step, `concurrency.steps[${index}]`)) as [ScenarioStep, ScenarioStep];
  if (value.expectedKind !== undefined && typeof value.expectedKind !== "string") {
    throw new Error("concurrency.expectedKind 必须是字符串");
  }
  return { setup, steps, expectedKind: value.expectedKind as string | undefined };
}

function parseAdapterConsistencyScenario(value: unknown): AdapterConsistencyScenario {
  if (!isRecord(value)) throw new Error("adapterConsistency 必须是对象");
  return {
    mcp: parseScenarioStep(value.mcp, "adapterConsistency.mcp"),
    opencli: parseScenarioStep(value.opencli, "adapterConsistency.opencli"),
  };
}

function parseQueryAssertion(value: unknown, path: string): QueryAssertion {
  if (!isRecord(value) || typeof value.resourceType !== "string") {
    throw new Error(`${path}.resourceType 必须是字符串`);
  }
  return value as unknown as QueryAssertion;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
