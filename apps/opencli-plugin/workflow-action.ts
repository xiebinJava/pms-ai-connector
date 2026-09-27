import { cli, Strategy } from "@jackwener/opencli/registry";
import type { AutomaticOperationRequest } from "../../packages/pms-contracts/src/index.js";
import {
  getPmsClient,
  contextResourceType,
  optionalString,
  parseJsonObject,
  positiveInteger,
  requestId,
  requiredString,
  runPmsCommand,
  validationError,
} from "./runtime.js";

cli({
  site: "pms",
  name: "workflow-action",
  description: "依据事项当前动态流程上下文执行允许的流程动作",
  access: "write",
  strategy: Strategy.LOCAL,
  browser: false,
  defaultFormat: "json",
  example: "opencli pms workflow-action topic 7 development-item.node.complete --idempotencyKey idem-1 -f json",
  args: [
    { name: "resourceType", positional: true, required: true, help: "requirement、project、topic 或 story" },
    { name: "resourceId", positional: true, required: true, type: "int", help: "资源 ID" },
    { name: "operation", positional: true, required: true, help: "流程上下文允许的操作名" },
    { name: "argumentsJson", type: "str", help: "JSON 格式的操作参数" },
    { name: "contractId", type: "str", help: "可选的能力契约 ID" },
    { name: "contractVersion", type: "str", help: "contractId 对应的版本" },
    { name: "idempotencyKey", type: "str", required: true, help: "本次写操作的幂等键" },
    { name: "requestId", type: "str", help: "可选请求 ID" },
  ],
  func: async (kwargs) => runPmsCommand(async () => {
    const resourceType = contextResourceType(kwargs.resourceType);
    const resourceId = positiveInteger(kwargs.resourceId, "resourceId");
    const operation = requiredString(kwargs.operation, "operation");
    const context = await getPmsClient().context({ type: resourceType, id: resourceId });
    if (!context.allowedActions.includes(operation)) {
      throw validationError("当前流程上下文不允许执行该动作");
    }
    if (context.version === null) {
      throw validationError("当前事项没有可用的流程版本上下文");
    }

    const contractId = optionalString(kwargs.contractId);
    const contractVersion = optionalString(kwargs.contractVersion);
    if (contractId && !contractVersion) throw validationError("contractVersion 不能为空");
    if (contractVersion && !contractId) throw validationError("contractId 不能为空");

    const request: AutomaticOperationRequest = {
      operation,
      arguments: parseJsonObject(kwargs.argumentsJson, "argumentsJson"),
      context: { id: `${resourceType}:${resourceId}`, version: String(context.version) },
      ...(contractId && contractVersion ? { contract: { id: contractId, version: contractVersion } } : {}),
      idempotencyKey: requiredString(kwargs.idempotencyKey, "idempotencyKey"),
      clientId: "opencli",
      requestId: requestId(kwargs.requestId),
    };
    return getPmsClient().execute(request);
  }),
});
