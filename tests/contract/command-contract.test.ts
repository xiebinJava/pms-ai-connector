import {
  automaticOperationRequestSchema,
  capabilityCatalogSchema,
  commandContractSchema,
  errorEnvelopeSchema,
  outputEnvelopeSchema,
} from "../../packages/pms-contracts/src/index.js";
import { describe, expect, it } from "vitest";

describe("PMS CLI command contract", () => {
  it("accepts the stable JSON success envelope and capability catalog", () => {
    const result = outputEnvelopeSchema.parse({
      ok: true,
      data: {
        resources: [],
        scopes: [],
        workflowTypes: [],
        version: "v1",
      },
      meta: {
        requestId: "req-1",
        clientId: "pms-cli",
      },
    });

    expect(result.ok).toBe(true);
    expect(capabilityCatalogSchema.parse(result.data).version).toBe("v1");
  });

  it("requires pms-cli, request metadata and idempotency for writes", () => {
    const request = automaticOperationRequestSchema.parse({
      operation: "project.create",
      arguments: { name: "订单中心" },
      idempotencyKey: "idem-1",
      clientId: "pms-cli",
      requestId: "req-1",
    });

    expect(request.clientId).toBe("pms-cli");
    expect(request.idempotencyKey).toBe("idem-1");
    expect(() => automaticOperationRequestSchema.parse({
      ...request,
      clientId: "unknown-client",
    })).toThrow();
  });

  it("keeps errors machine-readable and separate from success output", () => {
    const error = errorEnvelopeSchema.parse({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "无权执行该操作",
      },
      meta: { requestId: "req-2" },
    });

    expect(error.ok).toBe(false);
    expect(error.error.code).toBe("FORBIDDEN");
    expect(commandContractSchema.parse({
      command: "operation execute",
      format: "json",
      success: "stdout",
      failure: "stderr",
      exitCode: 1,
    }).format).toBe("json");
  });
});
