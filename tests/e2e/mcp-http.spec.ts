import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { capabilityCatalogSchema, operationResultSchema } from "../../packages/pms-contracts/src/index.js";
import { createPmsHttpServer } from "../../apps/mcp-server/src/http-main.js";
import { e2eEnabled, loadScenario } from "./helpers.js";

const protocolVersion = "2026-07-28";

describe("PMS MCP HTTP acceptance", () => {
  it.skipIf(process.env.PMS_E2E_MCP !== "true" || !e2eEnabled())(
    "serves the current protocol and completes an isolated write through the HTTP transport",
    async () => {
      const baseUrl = process.env.PMS_E2E_BASE_URL!;
      const token = process.env.PMS_E2E_TOKEN!;
      const scenario = await loadScenario();
      const server = createPmsHttpServer({
        env: {
          PMS_BASE_URL: baseUrl,
          PMS_MCP_HOST: "127.0.0.1",
          PMS_MCP_PORT: "0",
          PMS_MCP_ALLOW_INSECURE_LOCALHOST: "true",
          PMS_MCP_REQUIRE_AUTHORIZATION: "true",
        },
      });
      const port = await listen(server);
      const url = `http://127.0.0.1:${port}/mcp`;
      let projectId: number | undefined;
      let primaryFailure: unknown;

      try {
        const unauthorized = await fetch(url);
        expect(unauthorized.status).toBe(401);
        expect(unauthorized.headers.get("www-authenticate")).toBe("Bearer");

        const discovered = await rpc(url, token, "server/discover", {});
        expect(discovered.supportedVersions).toContain(protocolVersion);
        expect(discovered.capabilities?.tools).toBeDefined();

        const listed = await rpc(url, token, "tools/list", {});
        const toolNames = new Set((listed.tools ?? []).map((tool: { name: string }) => tool.name));
        expect([...toolNames]).toEqual(expect.arrayContaining([
          "pms_capabilities",
          "pms_search",
          "pms_get",
          "pms_get_context",
          "pms_execute_operation",
          "pms_workflow_action",
        ]));

        const capabilities = capabilityCatalogSchema.parse(await callTool(url, token, "pms_capabilities", {}));
        const operations = new Set(
          capabilities.resources.flatMap((resource) => [
            ...resource.actions.map((action) => action.name),
            ...(resource.workflow?.nodes ?? []).flatMap((node) =>
              node.components.flatMap((component) => component.actions)),
          ]),
        );
        expect(operations.has("project.create")).toBe(true);
        expect(operations.has("project.delete")).toBe(true);

        const createStep = scenario.steps.find((step) => step.operation === "project.create");
        if (!createStep) throw new Error("MCP HTTP 验收场景必须包含 project.create");
        const runId = randomUUID();
        const createResult = operationResultSchema.parse(await callTool(
          url,
          token,
          "pms_execute_operation",
          {
            operation: createStep.operation,
            arguments: resolve(createStep.arguments ?? {}, runId),
            idempotencyKey: resolve(createStep.idempotencyKey ?? `pms-mcp-http-${runId}`, runId),
            requestId: `pms-mcp-http-request-${runId}`,
          },
        ));
        expect(createResult.status).toBe("SUCCEEDED");
        const project = isRecord(createResult.data.project) ? createResult.data.project : createResult.data;
        projectId = Number(project.id);
        expect(Number.isInteger(projectId)).toBe(true);

        const searchResult = await callTool(url, token, "pms_search", {
          resourceType: "project",
          keyword: `PMS AI Connector sandbox ${runId}`,
          filters: {},
          page: 1,
          pageSize: 20,
        });
        expect(searchResult.items.some((item: { id: number }) => Number(item.id) === projectId)).toBe(true);

        const context = await callTool(url, token, "pms_get_context", {
          resourceType: "project",
          resourceId: projectId,
        });
        expect(context.resource).toEqual({ type: "project", id: projectId });
        expect(Array.isArray(context.allowedActions)).toBe(true);
      } catch (error) {
        primaryFailure = error;
      } finally {
        let cleanupFailure: unknown;
        if (projectId) {
          try {
            const cleanupStep = scenario.cleanup?.find((step) => step.operation === "project.delete");
            if (!cleanupStep) throw new Error("MCP HTTP 验收场景必须包含 project.delete cleanup");
            await callTool(url, token, "pms_execute_operation", {
              operation: cleanupStep.operation,
              arguments: {
                ...(resolve(cleanupStep.arguments ?? {}, "")),
                projectId,
              },
              idempotencyKey: `pms-mcp-http-cleanup-${randomUUID()}`,
              requestId: `pms-mcp-http-cleanup-request-${randomUUID()}`,
            });
          } catch (error) {
            cleanupFailure = error;
          }
        }
        try {
          await close(server);
        } finally {
          if (cleanupFailure && !primaryFailure) throw cleanupFailure;
          if (cleanupFailure) console.error("MCP HTTP 验收清理失败", cleanupFailure);
        }
      }

      if (primaryFailure) throw primaryFailure;
    },
  );
});

async function rpc(
  url: string,
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "Mcp-Method": method,
      "MCP-Protocol-Version": protocolVersion,
      ...(method === "tools/call" && typeof params.name === "string" ? { "Mcp-Name": params.name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: randomUUID(),
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientCapabilities": {},
          "io.modelcontextprotocol/clientInfo": { name: "pms-ai-connector-e2e", version: "0.1.0" },
        },
      },
    }),
  });
  const body = await response.json() as { result?: any; error?: { message?: string } };
  if (!response.ok || body.error) {
    throw new Error(`MCP ${method} 失败 (${response.status}): ${body.error?.message ?? "unknown error"}`);
  }
  return body.result;
}

async function callTool(
  url: string,
  token: string,
  name: string,
  input: Record<string, unknown>,
): Promise<any> {
  const result = await rpc(url, token, "tools/call", { name, arguments: input });
  if (result.isError) {
    throw new Error(`MCP 工具 ${name} 返回错误: ${JSON.stringify(result.structuredContent)}`);
  }
  return result.structuredContent;
}

function resolve(value: unknown, runId: string): any {
  if (typeof value === "string") return value.replace(/\{\{runId}}/g, runId);
  if (Array.isArray(value)) return value.map((item) => resolve(item, runId));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item, runId)]));
  return value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("MCP HTTP 验收服务未绑定端口"));
      } else {
        resolve(address.port);
      }
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
