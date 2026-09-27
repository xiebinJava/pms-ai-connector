import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import type { QueryRequest, QueryResult } from "../../../../../packages/pms-contracts/src/index.js";

export function search(client: PmsClient, request: QueryRequest): Promise<QueryResult> {
  return client.query(request);
}
