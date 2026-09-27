import { afterEach, describe, expect, it } from "vitest";
import { createPmsHttpServer, readHttpConfig } from "../../apps/mcp-server/src/http-main.js";

const openServers: Array<ReturnType<typeof createPmsHttpServer>> = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe("MCP HTTP entry", () => {
  it("uses the PMS application context path in its default base URL", () => {
    const config = readHttpConfig({});

    expect(config.baseUrl).toBe("http://localhost:8080/api");
    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(3000);
    expect(config.trustForwardedProto).toBe(false);
  });

  it("serves a dependency-free health endpoint", async () => {
    const server = createPmsHttpServer({
      env: {
        PMS_MCP_HOST: "127.0.0.1",
        PMS_MCP_PORT: "0",
        PMS_MCP_ALLOW_INSECURE_LOCALHOST: "true",
      },
    });
    openServers.push(server);

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind a TCP port");

    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
