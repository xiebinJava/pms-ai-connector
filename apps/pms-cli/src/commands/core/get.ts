import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import type { QueryItem } from "../../../../../packages/pms-contracts/src/index.js";

const CONTEXT_RESOURCES = new Set<QueryItem["type"]>(["project", "topic", "story", "requirement"]);

export async function getResource(client: PmsClient, resourceType: QueryItem["type"], resourceId: number) {
  if (CONTEXT_RESOURCES.has(resourceType)) {
    return client.context({ type: resourceType, id: resourceId });
  }
  return client.query({
    resourceType,
    filters: { id: resourceId },
    page: 1,
    pageSize: 1,
  });
}
