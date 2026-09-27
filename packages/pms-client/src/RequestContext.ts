import { randomUUID } from "node:crypto";
import type { AutomaticOperationRequest } from "../../pms-contracts/src/index.js";

export type PmsClientId = AutomaticOperationRequest["clientId"];

export interface RequestContext {
  readonly requestId: string;
  readonly clientId: PmsClientId;
}

export function createRequestContext(
  clientId: PmsClientId,
  requestIdFactory: () => string = randomUUID,
): RequestContext {
  const requestId = requestIdFactory().trim();
  if (!requestId) throw new Error("requestId 不能为空");
  return { requestId, clientId };
}
