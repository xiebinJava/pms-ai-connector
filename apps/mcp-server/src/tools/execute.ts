import * as z from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { PmsClientId } from "../../../../packages/pms-client/src/RequestContext.js";
import type { PmsClient } from "../../../../packages/pms-client/src/index.js";
import { automaticOperationRequestSchema } from "../../../../packages/pms-contracts/src/index.js";
import { toolFailure, toolSuccess } from "./result.js";

export const executeInputSchema = z.object({
  operation: z.string().trim().min(1).max(160),
  arguments: z.record(z.string(), z.unknown()).default({}),
  context: z.object({ id: z.string().trim().min(1), version: z.string().trim().min(1) }).optional(),
  contract: z.object({ id: z.string().trim().min(1), version: z.string().trim().min(1) }).optional(),
  idempotencyKey: z.string().trim().min(1).max(160),
  requestId: z.string().trim().min(1).max(160).optional(),
});

export type ExecuteInput = z.infer<typeof executeInputSchema>;

export async function executeTool(
  client: PmsClient,
  clientId: PmsClientId,
  requestIdFactory: () => string,
  input: unknown,
): Promise<CallToolResult> {
  try {
    const value = executeInputSchema.parse(input);
    const request = automaticOperationRequestSchema.parse({
      ...value,
      clientId,
      requestId: value.requestId ?? requestIdFactory(),
    });
    return toolSuccess(await client.execute(request));
  } catch (error) {
    return toolFailure(error);
  }
}
