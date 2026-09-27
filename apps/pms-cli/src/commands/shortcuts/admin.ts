import type { PmsClient } from "../../../../../packages/pms-client/src/index.js";
import { listCapabilities } from "../core/capabilities.js";

/** Admin shortcuts intentionally expose server-owned catalogs; mutations stay capability-driven. */
export const adminWorkflowTemplates = (client: PmsClient) => listCapabilities(client);
export const adminCapabilities = (client: PmsClient) => listCapabilities(client);
