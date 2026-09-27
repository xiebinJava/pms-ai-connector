import { cli, Strategy } from "@jackwener/opencli/registry";
import type { AutomaticOperationRequest } from "../../packages/pms-contracts/src/index.js";
import {
  getPmsClient,
  optionalString,
  parseJsonObject,
  requestId,
  requiredString,
  runPmsCommand,
  validationError,
} from "./runtime.js";

cli({
  site: "pms",
  name: "execute",
  description: "执行 PMS 能力目录中的自动写操作",
  access: "write",
  strategy: Strategy.LOCAL,
  browser: false,
  defaultFormat: "json",
  example: "opencli pms execute topic.create --argumentsJson '{\"title\":\"订单中心\"}' --idempotencyKey idem-1 -f json",
  args: [
    { name: "operation", positional: true, required: true, help: "能力目录中的稳定操作名" },
    { name: "argumentsJson", type: "str", help: "JSON 格式的操作参数" },
    { name: "contextId", type: "str", help: "可选的对象/节点上下文 ID" },
    { name: "contextVersion", type: "str", help: "contextId 对应的版本" },
    { name: "contractId", type: "str", help: "可选的能力契约 ID" },
    { name: "contractVersion", type: "str", help: "contractId 对应的版本" },
    { name: "idempotencyKey", type: "str", required: true, help: "本次写操作的幂等键" },
    { name: "requestId", type: "str", help: "可选请求 ID" },
  ],
  func: async (kwargs) => runPmsCommand(() => {
    const contextId = optionalString(kwargs.contextId);
    const contextVersion = optionalString(kwargs.contextVersion);
    const contractId = optionalString(kwargs.contractId);
    const contractVersion = optionalString(kwargs.contractVersion);
    if (contextId && !contextVersion) throw validationError("contextVersion 不能为空");
    if (contextVersion && !contextId) throw validationError("contextId 不能为空");
    if (contractId && !contractVersion) throw validationError("contractVersion 不能为空");
    if (contractVersion && !contractId) throw validationError("contractId 不能为空");

    const request: AutomaticOperationRequest = {
      operation: requiredString(kwargs.operation, "operation"),
      arguments: parseJsonObject(kwargs.argumentsJson, "argumentsJson"),
      ...(contextId && contextVersion ? { context: { id: contextId, version: contextVersion } } : {}),
      ...(contractId && contractVersion ? { contract: { id: contractId, version: contractVersion } } : {}),
      idempotencyKey: requiredString(kwargs.idempotencyKey, "idempotencyKey"),
      clientId: "opencli",
      requestId: requestId(kwargs.requestId),
    };
    return getPmsClient().execute(request);
  }),
});
