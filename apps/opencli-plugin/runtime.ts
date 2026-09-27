import { randomUUID } from "node:crypto";
import { CommandExecutionError } from "@jackwener/opencli/errors";
import {
  authProviderFromEnv,
  PmsClientError,
  PmsHttpClient,
} from "../../packages/pms-client/src/index.js";
import type { PmsClient } from "../../packages/pms-client/src/index.js";
import { resourceTypeSchema, type ResourceType } from "../../packages/pms-contracts/src/index.js";

type PmsClientFactory = () => PmsClient;

const defaultClientFactory: PmsClientFactory = () => new PmsHttpClient({
  baseUrl: process.env.PMS_BASE_URL ?? "http://localhost:8080",
  auth: authProviderFromEnv(process.env),
  clientId: "opencli",
});

let clientFactory: PmsClientFactory = defaultClientFactory;

export function getPmsClient(): PmsClient {
  return clientFactory();
}

export function setPmsClientFactoryForTests(factory: PmsClientFactory): void {
  clientFactory = factory;
}

export function resetPmsClientFactory(): void {
  clientFactory = defaultClientFactory;
}

export function parseJsonObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value !== "string") {
    throw validationError(`${fieldName} 必须是 JSON 对象字符串`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw validationError(`${fieldName} 不是有效的 JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw validationError(`${fieldName} 必须解析为 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

export function requiredString(value: unknown, fieldName: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw validationError(`${fieldName} 不能为空`);
  return normalized;
}

export function positiveInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw validationError(`${fieldName} 必须是正整数`);
  }
  return parsed;
}

export function validationError(message: string): CommandExecutionError {
  return new CommandExecutionError(JSON.stringify({
    ok: false,
    error: { kind: "validation", message },
  }));
}

export function resourceType(value: unknown, fieldName = "resourceType"): ResourceType {
  const parsed = resourceTypeSchema.safeParse(requiredString(value, fieldName));
  if (!parsed.success) throw validationError(`${fieldName} 不是受支持的 PMS 资源类型`);
  return parsed.data;
}

export function contextResourceType(value: unknown, fieldName = "resourceType"):
  Extract<ResourceType, "requirement" | "project" | "topic" | "story"> {
  const parsed = resourceType(value, fieldName);
  if (!["requirement", "project", "topic", "story"].includes(parsed)) {
    throw validationError(`${fieldName} 只能是 requirement、project、topic 或 story`);
  }
  return parsed as Extract<ResourceType, "requirement" | "project" | "topic" | "story">;
}

export function optionalString(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

export function requestId(value: unknown): string {
  return optionalString(value) ?? randomUUID();
}

export async function runPmsCommand<T extends object>(operation: () => Promise<T>): Promise<T[]> {
  try {
    return [await operation()];
  } catch (error) {
    throw toOpenCliError(error);
  }
}

export function toOpenCliError(error: unknown): CommandExecutionError {
  if (error instanceof CommandExecutionError) return error;

  const structured = error instanceof PmsClientError
    ? {
      kind: error.kind,
      message: error.message,
      ...(error.status === undefined ? {} : { status: error.status }),
      ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
    }
    : { kind: "internal", message: "PMS 命令执行失败" };

  return new CommandExecutionError(JSON.stringify({ ok: false, error: structured }));
}
