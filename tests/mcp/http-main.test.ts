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
    expect(config.resourcePath).toBe("/mcp");
    expect(config.oauthAuthorizationServers).toEqual([]);
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

  it("serves OAuth protected-resource metadata and advertises an actionable challenge", async () => {
    const server = createPmsHttpServer({
      env: {
        PMS_MCP_HOST: "127.0.0.1",
        PMS_MCP_PORT: "0",
        PMS_MCP_OAUTH_ISSUER: "https://id.example.com/",
        PMS_MCP_OAUTH_SCOPES: "pms:query:read,pms:command:execute",
        PMS_MCP_RESOURCE_PATH: "/mcp",
      },
    });
    openServers.push(server);

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind a TCP port");

    const metadataResponse = await fetch(
      `http://127.0.0.1:${address.port}/.well-known/oauth-protected-resource`,
    );
    expect(metadataResponse.status).toBe(200);
    expect(await metadataResponse.json()).toEqual({
      resource: `http://127.0.0.1:${address.port}/mcp`,
      authorization_servers: ["https://id.example.com/"],
      scopes_supported: ["pms:query:read", "pms:command:execute"],
      bearer_methods_supported: ["header"],
    });

    const unauthorized = await fetch(`http://127.0.0.1:${address.port}/mcp`);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="http://127.0.0.1:${address.port}/.well-known/oauth-protected-resource", scope="pms:query:read pms:command:execute"`,
    );
  });
});
