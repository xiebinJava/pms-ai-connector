import { CapabilityResolver } from "../../capabilities/CapabilityResolver.js";
import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";

export async function listCapabilities(client: PmsClient, scope?: string) {
  return new CapabilityResolver(client).list(scope);
}
