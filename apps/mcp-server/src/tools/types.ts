import type { PmsClient } from "../../../../packages/pms-client/src/index.js";
import type { PmsClientId } from "../../../../packages/pms-client/src/RequestContext.js";

export interface PmsToolOptions {
  clientId: PmsClientId;
  requestIdFactory: () => string;
}

export interface PmsToolDependencies {
  client: PmsClient;
  options: PmsToolOptions;
}
