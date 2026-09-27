import { afterEach, describe, expect, it } from "vitest";
import { getRegistry, Strategy } from "@jackwener/opencli/registry";
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
import {
  defaultPmsBaseUrl,
  resetPmsClientFactory,
  setPmsClientFactoryForTests,
  toOpenCliError,
} from "../../apps/opencli-plugin/runtime.js";

import "../../apps/opencli-plugin/capabilities.js";
import "../../apps/opencli-plugin/search.js";
import "../../apps/opencli-plugin/get.js";
import "../../apps/opencli-plugin/execute.js";
import "../../apps/opencli-plugin/workflow-action.js";

class FakePmsClient implements PmsClient {
  readonly calls = {
    query: [] as QueryRequest[],
    context: [] as ResourceRef[],
    execute: [] as AutomaticOperationRequest[],
  };

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
      totalPage: 0,
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

function command(name: string) {
  const value = getRegistry().get(`pms/${name}`);
  if (!value) throw new Error(`missing pms/${name}`);
  return value;
}

function runCommand(name: string, input: Record<string, unknown>): Promise<unknown> {
  const registered = command(name);
  if (registered.browser !== false || !registered.func) throw new Error(`pms/${name} is not local`);
  return registered.func(input);
}

afterEach(() => {
  resetPmsClientFactory();
});

describe("OpenCLI PMS plugin", () => {
  it("uses the PMS application context path when no base URL is configured", () => {
    expect(defaultPmsBaseUrl({})).toBe("http://localhost:8080/api");
  });

  it("registers top-level local commands that share the PMS client contract", () => {
    expect([...getRegistry().keys()].filter((key) => key.startsWith("pms/")).sort()).toEqual([
      "pms/capabilities",
      "pms/execute",
      "pms/get",
      "pms/search",
      "pms/workflow-action",
    ]);

    expect(command("search").strategy).toBe(Strategy.LOCAL);
    expect(command("search").browser).toBe(false);
  });

  it("routes search and get through the shared read client", async () => {
    const client = new FakePmsClient();
    setPmsClientFactoryForTests(() => client);

    await runCommand("search", {
      resourceType: "topic",
      keyword: "订单",
      filtersJson: '{"projectId":78}',
      page: 1,
      pageSize: 20,
    });
    await runCommand("get", { resourceType: "topic", resourceId: 7 });

    expect(client.calls.query).toEqual([{
      resourceType: "topic",
      keyword: "订单",
      filters: { projectId: 78 },
      page: 1,
      pageSize: 20,
    }]);
    expect(client.calls.context).toEqual([{ type: "topic", id: 7 }]);
  });

  it("routes automatic writes with an idempotency key and current workflow context", async () => {
    const client = new FakePmsClient();
    setPmsClientFactoryForTests(() => client);

    await runCommand("execute", {
      operation: "topic.create",
      argumentsJson: '{"title":"订单中心"}',
      idempotencyKey: "idem-1",
      requestId: "request-1",
    });
    await runCommand("workflow-action", {
      resourceType: "topic",
      resourceId: 7,
      operation: "development-item.node.field.update",
      argumentsJson: '{"itemType":"TOPIC","itemId":7,"nodeId":12,"fieldValues":{"note":"已确认"}}',
      idempotencyKey: "idem-2",
      requestId: "request-2",
    });

    expect(client.calls.execute).toEqual([
      {
        operation: "topic.create",
        arguments: { title: "订单中心" },
        idempotencyKey: "idem-1",
        clientId: "opencli",
        requestId: "request-1",
      },
      {
        operation: "development-item.node.field.update",
        arguments: {
          itemType: "TOPIC",
          itemId: 7,
          nodeId: 12,
          fieldValues: { note: "已确认" },
        },
        context: { id: "topic:7", version: "4" },
        idempotencyKey: "idem-2",
        clientId: "opencli",
        requestId: "request-2",
      },
    ]);
  });

  it("keeps failures non-zero and machine-readable without exposing arbitrary errors", () => {
    const error = toOpenCliError(new Error("secret connection string"));
    expect(error.message).toContain('"kind":"internal"');
    expect(error.message).not.toContain("secret connection string");
    expect(error.name).toBe("CommandExecutionError");
  });
});
