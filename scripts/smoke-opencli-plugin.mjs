import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(repoRoot, "dist", "opencli-plugin");
const opencli = process.env.OPENCLI_BIN ?? path.join(repoRoot, "node_modules", ".bin", "opencli");
const home = await mkdtemp(path.join(os.tmpdir(), "pms-opencli-smoke-"));
const server = createServer((request, response) => {
  if (request.url !== "/api/integration/ai/v1/capabilities"
      || request.headers.authorization !== "Bearer smoke-token") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ code: 404, msg: "not found" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    code: 200,
    msg: "操作成功",
    requestId: "opencli-smoke",
    data: {
      version: "ai-v1",
      resources: [],
      scopes: ["pms:query:read"],
      workflowTypes: [],
      today: "2026-09-27",
    },
  }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("OpenCLI smoke server failed to start");

try {
  const env = {
    ...process.env,
    HOME: home,
    PMS_BASE_URL: `http://127.0.0.1:${address.port}/api`,
    PMS_AUTH_TOKEN: "smoke-token",
  };
  await execFileAsync(opencli, ["plugin", "install", pluginDir], { cwd: repoRoot, env });
  const { stdout } = await execFileAsync(opencli, ["plugin", "list", "-f", "json"], { cwd: repoRoot, env });
  const plugins = JSON.parse(stdout);
  const pms = plugins.find((plugin) => plugin.name === "pms");
  if (!pms || !pms.commands.includes("capabilities") || !pms.commands.includes("workflow-action")) {
    throw new Error("OpenCLI plugin was installed without the expected PMS commands");
  }

  const capabilities = await execFileAsync(opencli, ["pms", "capabilities", "-f", "json"], {
    cwd: repoRoot,
    env,
  });
  const capabilityResult = JSON.parse(capabilities.stdout);
  if (!Array.isArray(capabilityResult) || capabilityResult[0]?.version !== "ai-v1") {
    throw new Error("OpenCLI capabilities command did not return the PMS response");
  }

  let validationFailed = false;
  try {
    await execFileAsync(opencli, ["pms", "execute", "topic.create", "--argumentsJson", "{}", "-f", "json"], {
      cwd: repoRoot,
      env,
    });
  } catch (error) {
    validationFailed = error?.code !== 0;
  }
  if (!validationFailed) throw new Error("OpenCLI did not reject a write without idempotencyKey");

  console.log("OpenCLI plugin smoke passed: " + pms.commands.length + " PMS commands installed and capabilities executed");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(home, { recursive: true, force: true });
}
