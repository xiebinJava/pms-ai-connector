import { spawn } from "node:child_process";

const port = process.env.PMS_CONFORMANCE_PORT ?? "3187";
const baseUrl = `http://127.0.0.1:${port}`;
const serverEnv = {
  ...process.env,
  PMS_BASE_URL: process.env.PMS_BASE_URL ?? "http://127.0.0.1:9/api",
  PMS_MCP_HOST: "127.0.0.1",
  PMS_MCP_PORT: port,
  PMS_MCP_ALLOW_INSECURE_LOCALHOST: "true",
  PMS_MCP_REQUIRE_AUTHORIZATION: "false",
  PMS_AUTH_TOKEN: process.env.PMS_AUTH_TOKEN ?? "conformance-token",
};

const server = spawn("./apps/mcp-server/node_modules/.bin/tsx", ["apps/mcp-server/src/http-main.ts"], {
  cwd: new URL("..", import.meta.url),
  env: serverEnv,
  stdio: "inherit",
});

let shuttingDown = false;
const stopServer = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!server.killed) server.kill("SIGTERM");
};

process.once("SIGINT", () => {
  stopServer();
  process.exitCode = 130;
});
process.once("SIGTERM", () => {
  stopServer();
  process.exitCode = 143;
});

try {
  await waitForHealth(`${baseUrl}/healthz`);
  const result = await runConformance(baseUrl);
  process.exitCode = result;
} finally {
  stopServer();
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function waitForHealth(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`MCP server health check timed out: ${url}`);
}

function runConformance(url) {
  return new Promise((resolve, reject) => {
    const runner = spawn("pnpm", [
      "exec",
      "conformance",
      "server",
      "--url",
      `${url}/mcp`,
      "--scenario",
      "server-stateless",
      "--spec-version",
      "2026-07-28",
      "--expected-failures",
      "conformance-baseline.yml",
    ], {
      cwd: new URL("..", import.meta.url),
      env: process.env,
      stdio: "inherit",
    });
    runner.once("error", reject);
    runner.once("exit", (code, signal) => {
      if (signal) reject(new Error(`MCP conformance runner exited with ${signal}`));
      else resolve(code ?? 1);
    });
  });
}
