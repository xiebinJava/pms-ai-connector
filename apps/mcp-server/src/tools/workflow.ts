import * as z from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { PmsClientId } from "../../../../packages/pms-client/src/RequestContext.js";
import type { PmsClient } from "../../../../packages/pms-client/src/index.js";
import { automaticOperationRequestSchema } from "../../../../packages/pms-contracts/src/index.js";
import { ToolFailureError, toolFailure, toolSuccess } from "./result.js";

const workflowResourceTypes = ["requirement", "project", "topic", "story"] as const;

export const workflowActionInputSchema = z.object({
  resourceType: z.enum(workflowResourceTypes),
  resourceId: z.number().int().positive(),
  operation: z.string().trim().min(1).max(160),
  arguments: z.record(z.string(), z.unknown()).default({}),
  contract: z.object({ id: z.string().trim().min(1), version: z.string().trim().min(1) }).optional(),
  idempotencyKey: z.string().trim().min(1).max(160),
  requestId: z.string().trim().min(1).max(160).optional(),
});

export type WorkflowActionInput = z.infer<typeof workflowActionInputSchema>;

export async function workflowActionTool(
  client: PmsClient,
  clientId: PmsClientId,
  requestIdFactory: () => string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const value = workflowActionInputSchema.parse(input);
    const context = await client.context({ type: value.resourceType, id: value.resourceId });
    if (!context.allowedActions.includes(value.operation)) {
      return toolFailure(new ToolFailureError("forbidden", "当前流程上下文不允许执行该动作"));
    }
    if (context.version === null) {
      return toolFailure(new ToolFailureError("validation", "当前事项没有可用的流程版本上下文"));
    }
    const request = automaticOperationRequestSchema.parse({
      operation: value.operation,
      arguments: value.arguments,
      context: { id: `${value.resourceType}:${value.resourceId}`, version: String(context.version) },
      contract: value.contract,
      idempotencyKey: value.idempotencyKey,
      clientId,
      requestId: value.requestId ?? requestIdFactory(),
    });
    return toolSuccess(await client.execute(request));
  } catch (error) {
    return toolFailure(error);
  }
}
