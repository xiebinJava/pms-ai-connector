import { cli, Strategy } from "@jackwener/opencli/registry";
import { getPmsClient, parseJsonObject, positiveInteger, queryResourceType, runPmsCommand } from "./runtime.js";

cli({
  site: "pms",
  name: "search",
  description: "查询 PMS 需求、项目、专题、故事、任务或迭代计划",
  access: "read",
  strategy: Strategy.LOCAL,
  browser: false,
  defaultFormat: "json",
  example: "opencli pms search topic --keyword 订单 -f json",
  args: [
    { name: "resourceType", positional: true, required: true, help: "资源类型，例如 topic 或 story" },
    { name: "keyword", type: "str", help: "搜索关键词" },
    { name: "filtersJson", type: "str", help: "JSON 格式的动态筛选条件" },
    { name: "page", type: "int", default: 1, help: "页码" },
    { name: "pageSize", type: "int", default: 20, help: "每页条数" },
  ],
  func: async (kwargs) => runPmsCommand(() => getPmsClient().query({
    resourceType: queryResourceType(kwargs.resourceType),
    keyword: kwargs.keyword === undefined ? undefined : String(kwargs.keyword),
    filters: parseJsonObject(kwargs.filtersJson, "filtersJson"),
    page: positiveInteger(kwargs.page ?? 1, "page"),
    pageSize: positiveInteger(kwargs.pageSize ?? 20, "pageSize"),
  })),
});
