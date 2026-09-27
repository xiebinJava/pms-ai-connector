import { describe, expect, it } from "vitest";
import type {
  AutomaticOperationRequest,
  CapabilityCatalog,
  OperationResult,
  QueryRequest,
  QueryResult,
  ResourceRef,
  WorkflowContext,
} from "../../packages/pms-contracts/src/index.js";
import type { PmsClient } from "../../packages/pms-client/src/index.js";
import { createPmsToolHandlers } from "../../apps/mcp-server/src/tools/index.js";
import { normalizeToolError } from "../../apps/mcp-server/src/tools/result.js";
import { createPmsHttpHandler } from "../../apps/mcp-server/src/transport.js";

class FakePmsClient implements PmsClient {
  readonly calls: {
    query: QueryRequest[];
    context: ResourceRef[];
    execute: AutomaticOperationRequest[];
  } = { query: [], context: [], execute: [] };

  async capabilities(): Promise<CapabilityCatalog> {
    return { version: "ai-v1", resources: [], scopes: [], workflowTypes: [] };
  }

  async query(request: QueryRequest): Promise<QueryResult> {
    this.calls.query.push(request);
    return {
      resourceType: request.resourceType,
      items: [],
      total: 0,
      page: request.page ?? 1,
      pageSize: request.pageSize ?? 20,
      queryScope: "current-user-readable",
    };
  }

  async context(resource: ResourceRef): Promise<WorkflowContext> {
    this.calls.context.push(resource);
    return {
      resource,
      version: 4,
      currentNode: { id: 12, key: "review", label: "评审" },
      workflow: { templateVersionId: 9, nodes: [] },
      allowedActions: ["development-item.node.field.update"],
    };
  }

  async execute(request: AutomaticOperationRequest): Promise<OperationResult> {
    this.calls.execute.push(request);
    return {
      operationId: "op-1",
      status: "SUCCEEDED",
      message: "完成",
      data: { topicId: 7 },
      warnings: [],
      refreshScopes: ["topic-detail"],
    };
  }
}

describe("MCP PMS tools", () => {
  it("exposes the stable tool set and routes reads through the shared client", async () => {
    const client = new FakePmsClient();
    const handlers = createPmsToolHandlers(client, {
      clientId: "mcp",
      requestIdFactory: () => "request-1",
    });

    expect(Object.keys(handlers).sort()).toEqual([
      "pms_capabilities",
      "pms_execute_operation",
      "pms_get",
      "pms_get_context",
      "pms_search",
      "pms_workflow_action",
    ]);

    await handlers.pms_search({
      resourceType: "topic",
      filters: { projectId: 78 },
      page: 1,
      pageSize: 20,
    });
    await handlers.pms_get({ resourceType: "topic", resourceId: 7 });
    await handlers.pms_get_context({ resourceType: "topic", resourceId: 7 });

    expect(client.calls.query).toEqual([{
      resourceType: "topic",
      filters: { projectId: 78 },
      page: 1,
      pageSize: 20,
    }]);
    expect(client.calls.context).toEqual([
      { type: "topic", id: 7 },
      { type: "topic", id: 7 },
    ]);
  });

  it("passes automatic writes to PMS with the configured client identity", async () => {
    const client = new FakePmsClient();
    const handlers = createPmsToolHandlers(client, {
      clientId: "mcp",
      requestIdFactory: () => "request-2",
    });

    const result = await handlers.pms_execute_operation({
      operation: "topic.create",
      arguments: { title: "订单中心" },
      idempotencyKey: "idem-1",
      requestId: "request-2",
    });

    expect(client.calls.execute[0]).toEqual({
      operation: "topic.create",
      arguments: { title: "订单中心" },
      idempotencyKey: "idem-1",
      clientId: "mcp",
      requestId: "request-2",
    });
    expect(result.structuredContent).toMatchObject({ operationId: "op-1", status: "SUCCEEDED" });
  });

  it("requires the server-owned workflow action allow-list before writing", async () => {
    const client = new FakePmsClient();
    const handlers = createPmsToolHandlers(client, {
      clientId: "mcp",
      requestIdFactory: () => "request-3",
    });

    const rejected = await handlers.pms_workflow_action({
      resourceType: "topic",
      resourceId: 7,
      operation: "development-item.node.complete",
      arguments: { itemType: "TOPIC", itemId: 7, nodeId: 12 },
      idempotencyKey: "idem-2",
      requestId: "request-3",
    });

    expect(rejected.isError).toBe(true);
    expect(rejected.structuredContent).toMatchObject({
      error: { kind: "forbidden" },
    });
    expect(client.calls.execute).toHaveLength(0);
  });

  it("maps both MCP-side validation and shared-contract validation to structured errors", async () => {
    const client = new FakePmsClient();
    const handlers = createPmsToolHandlers(client, {
      clientId: "mcp",
      requestIdFactory: () => "request-validation",
    });

    const missingIdempotencyKey = await handlers.pms_execute_operation({
      operation: "topic.create",
      arguments: { title: "订单中心" },
    });

    expect(missingIdempotencyKey.structuredContent).toMatchObject({
      error: { kind: "validation" },
    });
    expect(normalizeToolError(new Error("secret database connection string"))).toEqual({
      kind: "internal",
      message: "工具执行失败",
    });
  });

  it("uses the current dynamic workflow version as the operation context", async () => {
    const client = new FakePmsClient();
    const handlers = createPmsToolHandlers(client, {
      clientId: "mcp",
      requestIdFactory: () => "request-4",
    });

    await handlers.pms_workflow_action({
      resourceType: "topic",
      resourceId: 7,
      operation: "development-item.node.field.update",
      arguments: { itemType: "TOPIC", itemId: 7, nodeId: 12, fieldValues: { note: "已确认" }, version: 4 },
      idempotencyKey: "idem-3",
      requestId: "request-4",
    });

    expect(client.calls.execute[0]).toMatchObject({
      operation: "development-item.node.field.update",
      context: { id: "topic:7", version: "4" },
      clientId: "mcp",
    });
  });

  it("protects the HTTP handler with bearer auth, HTTPS, and an explicit origin allow-list", async () => {
    const client = new FakePmsClient();
    const handler = createPmsHttpHandler(() => client, {
      allowedOrigins: ["https://chatgpt.com"],
    });

    const missingAuth = await handler.fetch(new Request("https://pms.example.com/mcp"));
    expect(missingAuth.status).toBe(401);

    const insecure = await handler.fetch(new Request("http://pms.example.com/mcp", {
      headers: { authorization: "Bearer token" },
    }));
    expect(insecure.status).toBe(400);

    const disallowedOrigin = await handler.fetch(new Request("https://pms.example.com/mcp", {
      headers: {
        authorization: "Bearer token",
        origin: "https://evil.example.com",
      },
    }));
    expect(disallowedOrigin.status).toBe(403);

    const localDevelopmentHandler = createPmsHttpHandler(() => client, {
      allowInsecureLocalhost: true,
    });
    const local = await localDevelopmentHandler.fetch(new Request("http://localhost/mcp", {
      headers: { authorization: "Bearer token" },
    }));
    expect(local.status).not.toBe(400);
  });
});
