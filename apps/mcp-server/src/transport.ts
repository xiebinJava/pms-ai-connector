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
  /** OAuth protected-resource discovery and challenge metadata for remote MCP clients. */
  oauth?: PmsOAuthResourceOptions;
}

export interface PmsOAuthResourceOptions {
  /** Canonical MCP resource URL. When omitted, it is derived from the request host and resourcePath. */
  resource?: string;
  /** OAuth authorization servers that can issue tokens for the MCP resource. */
  authorizationServers?: readonly string[];
  /** Scopes requested by the MCP client and understood by PMS. */
  scopes?: readonly string[];
  /** MCP resource path used when deriving resource metadata. */
  resourcePath?: string;
}

export interface PmsHttpRequestContext {
  authorization: string | undefined;
  requestId?: string;
  traceHeaders: Readonly<Record<string, string>>;
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
  clientFactory: (authorization: string | undefined, context: PmsHttpRequestContext) => PmsClient,
  options: PmsHttpHandlerOptions = {},
): McpHttpHandler {
  const delegatedHandler = createMcpHandler(({ requestInfo }) => createPmsMcpServer(
    clientFactory(
      requestInfo?.headers.get("authorization") ?? undefined,
      requestContextFromHeaders(requestInfo?.headers),
    ),
    options.server,
  ), {
    legacy: options.legacy ?? "reject",
  });

  return {
    ...delegatedHandler,
    fetch: async (request, requestOptions) => {
      const metadataResponse = oauthMetadataResponse(request, options);
      if (metadataResponse) return metadataResponse;
      const securityResponse = validateHttpRequest(request, options);
      if (securityResponse) {
        return securityResponse;
      }
      return delegatedHandler.fetch(request, requestOptions);
    },
  };
}

function validateHttpRequest(request: Request, options: PmsHttpHandlerOptions): Response | undefined {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return jsonErrorResponse(400, "请求地址无效");
  }

  const authorization = request.headers.get("authorization");
  if (options.requireAuthorization !== false && !isBearerAuthorization(authorization)) {
    return jsonErrorResponse(401, "需要 Bearer 身份认证", {
      "WWW-Authenticate": oauthChallenge(request, options),
    });
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

export function requestContextFromHeaders(headers: Headers | undefined): PmsHttpRequestContext {
  const source = headers ?? new Headers();
  return {
    authorization: source.get("authorization") ?? undefined,
    requestId: boundedHeader(source.get("x-request-id"), 160),
    traceHeaders: Object.fromEntries(
      ["traceparent", "tracestate", "baggage"]
        .map((name) => [name, boundedHeader(source.get(name), name === "baggage" ? 8192 : 1024)])
        .filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
  };
}

function boundedHeader(value: string | null, maxLength: number): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maxLength) return undefined;
  return normalized;
}

function oauthChallenge(request: Request, options: PmsHttpHandlerOptions): string {
  if (!options.oauth?.authorizationServers?.length) return "Bearer";
  const metadataUrl = absoluteExternalUrl(
    request,
    "/.well-known/oauth-protected-resource",
    options.trustForwardedProto === true,
  );
  const scopes = options.oauth?.scopes ?? [];
  const scopePart = scopes.length > 0 ? `, scope="${scopes.join(" ")}"` : "";
  return `Bearer resource_metadata="${metadataUrl}"${scopePart}`;
}

function oauthMetadataResponse(request: Request, options: PmsHttpHandlerOptions): Response | undefined {
  const oauth = options.oauth;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return undefined;
  }
  const resourcePath = normalizeResourcePath(oauth?.resourcePath ?? "/mcp");
  const metadataPaths = new Set([
    "/.well-known/oauth-protected-resource",
    `${resourcePath}/.well-known/oauth-protected-resource`,
  ]);
  if (!metadataPaths.has(url.pathname)) return undefined;
  if (request.method !== "GET") {
    return jsonErrorResponse(405, "OAuth 元数据只支持 GET", { Allow: "GET" });
  }
  if (!oauth?.authorizationServers?.length) {
    return jsonErrorResponse(404, "OAuth 资源元数据未配置");
  }

  const body = {
    resource: oauth.resource ?? absoluteExternalUrl(
      request,
      resourcePath,
      options.trustForwardedProto === true,
    ),
    authorization_servers: oauth.authorizationServers,
    scopes_supported: oauth.scopes ?? [],
    bearer_methods_supported: ["header"],
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function absoluteExternalUrl(request: Request, path: string, trustForwardedProto: boolean): string {
  const url = new URL(request.url);
  const forwardedProto = trustForwardedProto
    ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim()
    : undefined;
  const forwardedHost = trustForwardedProto
    ? request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    : undefined;
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : url.protocol.replace(":", "");
  const host = forwardedHost || request.headers.get("host") || url.host;
  return new URL(path, `${protocol}://${host}`).toString();
}

function normalizeResourcePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || !trimmed.startsWith("/")) throw new Error("PMS_MCP_RESOURCE_PATH 必须以 / 开头");
  return trimmed.length > 1 ? trimmed.replace(/\/$/, "") : trimmed;
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
