import { cli, Strategy } from "@jackwener/opencli/registry";
import { getPmsClient, runPmsCommand } from "./runtime.js";

cli({
  site: "pms",
  name: "capabilities",
  description: "读取当前用户可用的 PMS 资源、动作和动态流程能力",
  access: "read",
  strategy: Strategy.LOCAL,
  browser: false,
  defaultFormat: "json",
  example: "opencli pms capabilities -f json",
  args: [],
  func: async () => runPmsCommand(() => getPmsClient().capabilities()),
});
