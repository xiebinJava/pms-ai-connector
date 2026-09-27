import { createServer, type Server } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { type McpHttpHandler } from "@modelcontextprotocol/server";
import {
  AuthProviderError,
  PmsHttpClient,
  StaticTokenProvider,
} from "../../../packages/pms-client/src/index.js";
import { createPmsHttpHandler } from "./transport.js";
import type { PmsHttpRequestContext } from "./transport.js";

export interface PmsHttpConfig {
  baseUrl: string;
  host: string;
  port: number;
  allowedOrigins: readonly string[];
  allowInsecureLocalhost: boolean;
  trustForwardedProto: boolean;
  requireAuthorization: boolean;
  legacy: "stateless" | "reject";
  resourcePath: string;
  oauthAuthorizationServers: readonly string[];
  oauthResource?: string;
  oauthScopes: readonly string[];
  name: string;
  version: string;
}

export interface PmsHttpServerOptions {
  env?: Record<string, string | undefined>;
  handler?: McpHttpHandler;
}

export function readHttpConfig(
  env: Record<string, string | undefined> = process.env,
): PmsHttpConfig {
  return {
    baseUrl: env.PMS_BASE_URL ?? "http://localhost:8080/api",
    host: env.PMS_MCP_HOST ?? "0.0.0.0",
    port: parsePort(env.PMS_MCP_PORT ?? "3000"),
    allowedOrigins: splitCsv(env.PMS_MCP_ALLOWED_ORIGINS),
    allowInsecureLocalhost: env.PMS_MCP_ALLOW_INSECURE_LOCALHOST === "true",
    trustForwardedProto: env.PMS_MCP_TRUST_FORWARDED_PROTO === "true",
    requireAuthorization: env.PMS_MCP_REQUIRE_AUTHORIZATION !== "false",
    legacy: env.PMS_MCP_LEGACY === "stateless" ? "stateless" : "reject",
    resourcePath: normalizeResourcePath(env.PMS_MCP_RESOURCE_PATH ?? "/mcp"),
    oauthAuthorizationServers: splitCsv(env.PMS_MCP_OAUTH_ISSUER),
    oauthResource: env.PMS_MCP_OAUTH_RESOURCE?.trim() || undefined,
    oauthScopes: splitCsv(env.PMS_MCP_OAUTH_SCOPES),
    name: env.PMS_MCP_SERVER_NAME ?? "pms-mcp-server",
    version: env.PMS_MCP_SERVER_VERSION ?? "0.1.0",
  };
}

export function createPmsHttpServer(options: PmsHttpServerOptions = {}): Server {
  const env = options.env ?? process.env;
  const config = readHttpConfig(env);
  const handler = options.handler ?? createPmsHttpHandler(
    (authorization, context: PmsHttpRequestContext) => {
      const clientOptions: ConstructorParameters<typeof PmsHttpClient>[0] = {
        baseUrl: config.baseUrl,
        auth: tokenProviderFromRequest(authorization, env),
        clientId: "mcp",
        traceHeaders: context.traceHeaders,
      };
      if (context.requestId) clientOptions.requestIdFactory = () => context.requestId as string;
      return new PmsHttpClient(clientOptions);
    },
    {
      allowedOrigins: config.allowedOrigins,
      allowInsecureLocalhost: config.allowInsecureLocalhost,
      trustForwardedProto: config.trustForwardedProto,
      requireAuthorization: config.requireAuthorization,
      legacy: config.legacy,
      oauth: {
        resource: config.oauthResource,
        resourcePath: config.resourcePath,
        authorizationServers: config.oauthAuthorizationServers,
        scopes: config.oauthScopes,
      },
      server: { name: config.name, version: config.version },
    },
  );
  const nodeHandler = toNodeHandler(handler, {
    onerror: () => console.error("PMS MCP HTTP 请求处理失败"),
  });

  return createServer((request, response) => {
    if (request.url && new URL(request.url, `http://${request.headers.host ?? "localhost"}`).pathname === "/healthz") {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    void nodeHandler(request, response).catch(() => {
      if (response.headersSent || response.writableEnded) return;
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "MCP HTTP 请求处理失败" }));
    });
  });
}

function tokenProviderFromRequest(
  authorization: string | undefined,
  env: Record<string, string | undefined>,
): StaticTokenProvider {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? env.PMS_AUTH_TOKEN;
  if (!token) throw new AuthProviderError("MCP HTTP 请求缺少认证 Token");
  return new StaticTokenProvider(token);
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("PMS_MCP_PORT 必须是 0 到 65535 之间的整数");
  }
  return port;
}

function splitCsv(value: string | undefined): readonly string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeResourcePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || !trimmed.startsWith("/")) {
    throw new Error("PMS_MCP_RESOURCE_PATH 必须以 / 开头");
  }
  return trimmed.length > 1 ? trimmed.replace(/\/$/, "") : trimmed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = readHttpConfig();
  const server = createPmsHttpServer();
  server.listen(config.port, config.host, () => {
    console.error(`PMS MCP HTTP listening on ${config.host}:${config.port}`);
  });
}
