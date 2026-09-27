import { McpServer } from "@modelcontextprotocol/server";
import { randomUUID } from "node:crypto";
import type { PmsClient } from "../../../packages/pms-client/src/index.js";
import type { PmsClientId } from "../../../packages/pms-client/src/RequestContext.js";
import { capabilitiesInputSchema } from "./tools/capabilities.js";
import { executeInputSchema } from "./tools/execute.js";
import { resourceContextInputSchema, searchInputSchema } from "./tools/query.js";
import { workflowActionInputSchema } from "./tools/workflow.js";
import { createPmsToolHandlers } from "./tools/index.js";

export interface PmsMcpServerOptions {
  clientId?: PmsClientId;
  requestIdFactory?: () => string;
  name?: string;
  version?: string;
}

export function createPmsMcpServer(client: PmsClient, options: PmsMcpServerOptions = {}): McpServer {
  const handlers = createPmsToolHandlers(client, {
    clientId: options.clientId ?? "mcp",
    requestIdFactory: options.requestIdFactory ?? randomUUID,
  });
  const server = new McpServer({
    name: options.name ?? "pms-mcp-server",
    version: options.version ?? "0.1.0",
  }, { capabilities: { tools: {} } });

  server.registerTool("pms_capabilities", {
    title: "PMS 能力目录",
    description: "读取当前用户可用的 PMS 资源、写操作、流程模板、节点、组件和字段。",
    inputSchema: capabilitiesInputSchema,
  }, () => handlers.pms_capabilities());
  server.registerTool("pms_search", {
    title: "搜索 PMS 资源",
    description: "按资源类型和动态过滤条件查询需求、项目、专题、故事、任务或迭代计划。",
    inputSchema: searchInputSchema,
  }, (input) => handlers.pms_search(input));
  server.registerTool("pms_get", {
    title: "读取 PMS 流程上下文",
    description: "读取项目、需求、专题或故事的当前流程上下文；资源详情字段以后端详情接口为准。",
    inputSchema: resourceContextInputSchema,
  }, (input) => handlers.pms_get(input));
  server.registerTool("pms_get_context", {
    title: "读取 PMS 流程上下文",
    description: "读取事项绑定的流程版本、当前节点、运行时组件、字段值和允许动作。",
    inputSchema: resourceContextInputSchema,
  }, (input) => handlers.pms_get_context(input));
  server.registerTool("pms_execute_operation", {
    title: "执行 PMS 操作",
    description: "调用 PMS 后端执行一个能力目录中的自动写操作；权限、业务、版本、幂等和审计由 PMS 校验。",
    inputSchema: executeInputSchema,
  }, (input) => handlers.pms_execute_operation(input));
  server.registerTool("pms_workflow_action", {
    title: "执行流程动作",
    description: "先读取事项当前流程上下文的允许动作，再执行动态流程节点操作。",
    inputSchema: workflowActionInputSchema,
  }, (input) => handlers.pms_workflow_action(input));
  return server;
}
