import type { CallToolResult } from "@modelcontextprotocol/server";
import { CapabilityResolutionError } from "../../../../packages/pms-capabilities/src/index.js";
import { PmsClientError } from "../../../../packages/pms-client/src/index.js";

interface ZodLikeError extends Error {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}

export class ToolFailureError extends Error {
  constructor(
    readonly kind: "validation" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "ToolFailureError";
  }
}

export function toolSuccess<T extends object>(value: T): CallToolResult {
  const structuredContent = value as Record<string, unknown>;
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent,
  };
}

export function toolFailure(error: unknown): CallToolResult {
  const normalized = normalizeToolError(error);
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: normalized }) }],
    structuredContent: { error: normalized },
  };
}

export function normalizeToolError(error: unknown): Record<string, unknown> {
  if (error instanceof PmsClientError) {
    return {
      kind: error.kind,
      message: error.message,
      ...(error.status === undefined ? {} : { status: error.status }),
      ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }
  if (error instanceof CapabilityResolutionError) {
    return { kind: "capability_not_found", message: error.message };
  }
  if (error instanceof ToolFailureError) {
    return { kind: error.kind, message: error.message };
  }
  if (isZodLikeError(error)) {
    return {
      kind: "validation",
      message: "工具参数校验失败",
      fields: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    };
  }
  if (error instanceof Error) {
    return { kind: "internal", message: "工具执行失败" };
  }
  return { kind: "internal", message: "工具执行失败" };
}

function isZodLikeError(error: unknown): error is ZodLikeError {
  return error instanceof Error
    && Array.isArray((error as Partial<ZodLikeError>).issues);
}
