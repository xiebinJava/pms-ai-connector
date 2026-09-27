import { describe, expect, it } from "vitest";
import {
  automaticOperationRequestSchema,
  operationResultSchema,
  queryResultSchema,
  resourceTypeSchema,
} from "../../packages/pms-contracts/src/index.js";

describe("PMS connector shared schemas", () => {
  it("rejects an operation request without required execution metadata", () => {
    const result = automaticOperationRequestSchema.safeParse({
      arguments: {},
      clientId: "mcp",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown resources and result statuses", () => {
    expect(resourceTypeSchema.safeParse("unknown").success).toBe(false);
    expect(
      operationResultSchema.safeParse({
        operationId: "op-1",
        status: "WAITING_FOR_CONFIRMATION",
        data: {},
        warnings: [],
        refreshScopes: [],
      }).success,
    ).toBe(false);
  });

  it("accepts an automatic operation with an optional page context", () => {
    const result = automaticOperationRequestSchema.parse({
      operation: "topic.create",
      arguments: { name: "订单中心" },
      idempotencyKey: "idem-1",
      clientId: "opencli",
      requestId: "req-1",
    });

    expect(result.operation).toBe("topic.create");
    expect(result.context).toBeUndefined();
  });

  it("keeps the PMS pagination envelope complete", () => {
    const result = queryResultSchema.parse({
      resourceType: "topic",
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPage: 0,
      queryScope: "current-user-readable",
    });

    expect(result.totalPage).toBe(0);
    expect(() => queryResultSchema.parse({
      resourceType: "topic",
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      queryScope: "current-user-readable",
    })).toThrow();
  });
});
