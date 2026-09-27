import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import type { QueryItem } from "../../../../../packages/pms-contracts/src/index.js";

export function getContext(client: PmsClient, resourceType: QueryItem["type"], resourceId: number) {
  return client.context({ type: resourceType, id: resourceId });
}
