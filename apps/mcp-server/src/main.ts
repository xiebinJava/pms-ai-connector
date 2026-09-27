import { authProviderFromEnv, PmsHttpClient } from "../../../packages/pms-client/src/index.js";
import { servePmsStdio } from "./transport.js";

const baseUrl = process.env.PMS_BASE_URL ?? "http://localhost:8080";
const client = new PmsHttpClient({
  baseUrl,
  auth: authProviderFromEnv(process.env),
  clientId: "mcp",
});

servePmsStdio(() => client, {
  name: process.env.PMS_MCP_SERVER_NAME ?? "pms-mcp-server",
  version: process.env.PMS_MCP_SERVER_VERSION ?? "0.1.0",
});
