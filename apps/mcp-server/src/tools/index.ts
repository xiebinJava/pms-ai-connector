import type { PmsClient } from "../../../../packages/pms-client/src/index.js";
import type { PmsClientId } from "../../../../packages/pms-client/src/RequestContext.js";
import { capabilitiesTool } from "./capabilities.js";
import { executeTool } from "./execute.js";
import { getContextTool, searchTool } from "./query.js";
import { workflowActionTool } from "./workflow.js";
import type { CallToolResult } from "@modelcontextprotocol/server";

export interface PmsToolHandlers {
  pms_capabilities: (input?: unknown) => Promise<CallToolResult>;
  pms_search: (input: unknown) => Promise<CallToolResult>;
  pms_get: (input: unknown) => Promise<CallToolResult>;
  pms_get_context: (input: unknown) => Promise<CallToolResult>;
  pms_execute_operation: (input: unknown) => Promise<CallToolResult>;
  pms_workflow_action: (input: unknown) => Promise<CallToolResult>;
}

export function createPmsToolHandlers(
  client: PmsClient,
  options: { clientId: PmsClientId; requestIdFactory: () => string },
): PmsToolHandlers {
  return {
    pms_capabilities: () => capabilitiesTool(client),
    pms_search: (input) => searchTool(client, input),
    // Until the PMS detail facade exists, get is deliberately context-based.
    // It must not pretend that a list query filtered by an unsupported id is a detail read.
    pms_get: (input) => getContextTool(client, input),
    pms_get_context: (input) => getContextTool(client, input),
    pms_execute_operation: (input) => executeTool(client, options.clientId, options.requestIdFactory, input),
    pms_workflow_action: (input) => workflowActionTool(client, options.clientId, options.requestIdFactory, input),
  };
}
