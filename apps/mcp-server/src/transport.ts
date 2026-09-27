import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { serveStdio, type StdioServerHandle } from "@modelcontextprotocol/server/stdio";
import type { PmsClient } from "../../../packages/pms-client/src/index.js";
import { createPmsMcpServer, type PmsMcpServerOptions } from "./server.js";

export interface PmsHttpHandlerOptions {
  /** PMS server options shared by every per-request MCP server instance. */
  server?: PmsMcpServerOptions;
  /** Exact browser origins allowed to call the HTTP endpoint. */
  allowedOrigins?: readonly string[];
  /** Local-only escape hatch for development over http://localhost. */
  allowInsecureLocalhost?: boolean;
  /** Trust X-Forwarded-Proto only when the process is behind a controlled proxy. */
  trustForwardedProto?: boolean;
  /** Keep authentication mandatory unless a trusted outer gateway is explicitly configured. */
  requireAuthorization?: boolean;
  /** Reject legacy MCP traffic by default; opt in only when an older client is required. */
  legacy?: "stateless" | "reject";
}

export function servePmsStdio(
  clientFactory: () => PmsClient,
  options: PmsMcpServerOptions = {},
): StdioServerHandle {
  return serveStdio(() => createPmsMcpServer(clientFactory(), options), {
    legacy: "serve",
    onerror: (error) => console.error("PMS MCP stdio error", error.message),
  });
}

export function createPmsHttpHandler(
  clientFactory: (authorization: string | undefined) => PmsClient,
  options: PmsHttpHandlerOptions = {},
): McpHttpHandler {
  const delegatedHandler = createMcpHandler(({ requestInfo }) => createPmsMcpServer(
    clientFactory(requestInfo?.headers.get("authorization") ?? undefined),
    options.server,
  ), {
    legacy: options.legacy ?? "reject",
  });

  return {
    ...delegatedHandler,
    fetch: async (request, requestOptions) => {
      const securityResponse = validateHttpRequest(request, options);
      if (securityResponse) {
        return securityResponse;
      }
      return delegatedHandler.fetch(request, requestOptions);
    },
  };
}

function validateHttpRequest(request: Request, options: PmsHttpHandlerOptions): Response | undefined {
  const authorization = request.headers.get("authorization");
  if (options.requireAuthorization !== false && !isBearerAuthorization(authorization)) {
    return jsonErrorResponse(401, "需要 Bearer 身份认证", { "WWW-Authenticate": "Bearer" });
  }

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return jsonErrorResponse(400, "请求地址无效");
  }

  const forwardedProto = options.trustForwardedProto === true
    ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase()
    : undefined;
  const isSecure = url.protocol === "https:" || forwardedProto === "https";
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!isSecure && !(options.allowInsecureLocalhost === true && isLocalhost)) {
    return jsonErrorResponse(400, "MCP HTTP 接口必须通过 HTTPS 或可信反向代理访问");
  }

  const origin = request.headers.get("origin");
  if (origin !== null && !isAllowedOrigin(origin, options.allowedOrigins ?? [])) {
    return jsonErrorResponse(403, "请求来源不在允许列表中");
  }

  return undefined;
}

function isBearerAuthorization(value: string | null): value is string {
  return value !== null && /^Bearer\s+\S+$/i.test(value);
}

function isAllowedOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  return allowedOrigins.includes(origin);
}

function jsonErrorResponse(
  status: number,
  message: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}
