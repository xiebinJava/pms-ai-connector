import { cli, Strategy } from "@jackwener/opencli/registry";
import { contextResourceType, getPmsClient, positiveInteger, runPmsCommand } from "./runtime.js";

cli({
  site: "pms",
  name: "get",
  description: "读取项目、需求、专题或故事的流程上下文",
  access: "read",
  strategy: Strategy.LOCAL,
  browser: false,
  defaultFormat: "json",
  example: "opencli pms get topic 7 -f json",
  args: [
    { name: "resourceType", positional: true, required: true, help: "requirement、project、topic 或 story" },
    { name: "resourceId", positional: true, required: true, type: "int", help: "资源 ID" },
  ],
  func: async (kwargs) => runPmsCommand(() => getPmsClient().context({
    type: contextResourceType(kwargs.resourceType),
    id: positiveInteger(kwargs.resourceId, "resourceId"),
  })),
});
