import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import type { QueryItem } from "../../../../../packages/pms-contracts/src/index.js";
import { operationExecute, type OperationOptions } from "./operation.js";

export async function workflowAction(
  client: PmsClient,
  resourceType: QueryItem["type"],
  resourceId: number,
  action: string,
  options: OperationOptions = {},
) {
  const context = await client.context({ type: resourceType, id: resourceId });
  if (!context.allowedActions.includes(action)) {
    throw new Error(`当前对象不允许执行操作: ${action}`);
  }
  const contextVersion = String(context.version ?? "v1");
  return operationExecute(client, action, options.requestId ?? `workflow-${resourceType}-${resourceId}-${action}`, {
    ...options,
    context: options.context ?? { id: `${resourceType}:${resourceId}`, version: contextVersion },
  });
}
