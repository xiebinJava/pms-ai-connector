import { describe, expect, it } from "vitest";
import { PmsHttpClient, StaticTokenProvider } from "../../packages/pms-client/src/index.js";
import { OutputWriter } from "../../apps/pms-cli/src/output/OutputWriter.js";

describe("PMS CLI client protocol", () => {
  it("uses the read-only preview facade before a write", async () => {
    let requestUrl = "";
    const client = new PmsHttpClient({
      baseUrl: "http://localhost:8080/api",
      auth: new StaticTokenProvider("short-token"),
      clientId: "pms-cli",
      fetchImpl: async (input) => {
        requestUrl = String(input);
        return new Response(JSON.stringify({
          code: 200,
          data: {
            operationId: "preview-1",
            command: "project.create",
            expiresAt: "2026-09-27T15:00:00Z",
            contextVersion: "v1",
            warnings: [],
            changes: [],
            refreshScopes: [],
          },
        }), { status: 200 });
      },
    });

    const preview = await client.preview({
      operation: "project.create",
      arguments: { name: "订单中心" },
      idempotencyKey: "preview-idem",
      clientId: "pms-cli",
      requestId: "preview-req",
    });

    expect(requestUrl).toContain("/integration/ai/v1/operations/preview");
    expect(preview.operationId).toBe("preview-1");
  });

  it("sends pms-cli and idempotency headers for writes", async () => {
    let captured: RequestInit | undefined;
    const client = new PmsHttpClient({
      baseUrl: "http://localhost:8080/api",
      auth: new StaticTokenProvider("short-token"),
      clientId: "pms-cli",
      fetchImpl: async (_input, init) => {
        captured = init;
        return new Response(JSON.stringify({
          code: 200,
          data: { operationId: "op-1", status: "SUCCEEDED", data: {}, refreshScopes: [] },
        }), { status: 200 });
      },
    });

    await client.execute({
      operation: "project.create",
      arguments: { name: "订单中心" },
      idempotencyKey: "idem-1",
      clientId: "pms-cli",
      requestId: "req-1",
    });

    const headers = new Headers(captured?.headers);
    expect(headers.get("client-id")).toBe("pms-cli");
    expect(headers.get("x-client-id")).toBe("pms-cli");
    expect(headers.get("idempotency-key")).toBe("idem-1");
  });

  it("writes successful JSON to stdout and failures to stderr", () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode = 0;
    const writer = new OutputWriter(
      (value) => stdout.push(value),
      (value) => stderr.push(value),
      (value) => { exitCode = value; },
    );

    writer.success({ projects: [] }, { requestId: "req-1" });
    writer.failure({ code: "FORBIDDEN", message: "无权执行", requestId: "req-2" });

    expect(JSON.parse(stdout[0]).ok).toBe(true);
    expect(JSON.parse(stderr[0]).ok).toBe(false);
    expect(exitCode).toBe(1);
  });
});
