#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PmsHttpClient, StaticTokenProvider } from "../../../packages/pms-client/src/index.js";
import { AuthStore } from "./auth/AuthStore.js";
import { BrowserAuth } from "./auth/BrowserAuth.js";
import { authLogin, authLogout, authStatus } from "./commands/core/auth.js";
import { listCapabilities } from "./commands/core/capabilities.js";
import { getContext } from "./commands/core/context.js";
import { doctor } from "./commands/core/doctor.js";
import { getResource } from "./commands/core/get.js";
import { operationExecute, operationPreview } from "./commands/core/operation.js";
import { search } from "./commands/core/search.js";
import { setup } from "./commands/core/setup.js";
import { workflowAction } from "./commands/core/workflow.js";
import { dashboardSummary } from "./commands/shortcuts/dashboard.js";
import { OutputWriter } from "./output/OutputWriter.js";

const HELP = `PMS CLI

  pms auth login|status|logout
  pms capabilities [--scope <scope>]
  pms search <resourceType> [--keyword <text>] [--filter key=value]
  pms get <resourceType> <id>
  pms context <resourceType> <id>
  pms operation preview <operation> --arguments-json <json>
  pms operation execute <operation> --arguments-json <json> --idempotency-key <key>
  pms workflow action <resourceType> <id> <action> --arguments-json <json>
  pms dashboard summary
  pms setup | pms doctor --format json
  pms skill install --global
`;
const VERSION = "0.1.0";

interface CliRuntime {
  client: PmsHttpClient;
  account: Awaited<ReturnType<AuthStore["getActiveAccount"]>>;
}

async function main(argv: string[] = process.argv.slice(2)): Promise<unknown> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  const [group, command, ...rest] = argv;
  if (group === "doctor") {
    const report = doctor();
    if (argv.includes("--format") && argv.includes("json")) process.stdout.write(`${JSON.stringify(report)}\n`);
    else process.stdout.write(`${formatDoctor(report)}\n`);
    return report;
  }
  if (group === "setup") return setup();
  if (group === "skill" && command === "install" && rest.includes("--global")) {
    return installSkill();
  }
  if (group === "auth") return runAuth(command, rest);

  const runtime = await authenticatedRuntime();
  if (group === "capabilities") return listCapabilities(runtime.client, option([command, ...rest], "scope"));
  if (group === "search") return search(runtime.client, {
    resourceType: command as never,
    keyword: option(rest, "keyword"),
    filters: parseFilters(rest),
    page: Number(option(rest, "page") ?? 1),
    pageSize: Number(option(rest, "page-size") ?? 20),
  });
  if (group === "get") return getResource(runtime.client, command as never, requireNumber(command, rest[0]));
  if (group === "context") return getContext(runtime.client, command as never, requireNumber(command, rest[0]));
  if (group === "dashboard" && command === "summary") return dashboardSummary(runtime.client);
  if (group === "operation") return runOperation(runtime, command, rest);
  if (group === "workflow" && command === "action") {
    const [resourceType, id, action, ...flags] = rest;
    return workflowAction(runtime.client, resourceType as never, Number(id), action, operationOptions(flags));
  }
  throw new Error(`未知命令，请执行 pms --help: ${[group, command].filter(Boolean).join(" ")}`);
}

async function runAuth(command: string | undefined, args: string[]) {
  const store = new AuthStore();
  const baseUrl = process.env.PMS_BASE_URL?.trim() || "http://localhost:5173/api";
  const authOrigin = process.env.PMS_AUTH_ORIGIN?.trim() || originFromBase(baseUrl);
  if (command === "login") return authLogin({ baseUrl, authOrigin, store });
  if (command === "status") return authStatus(store);
  if (command === "logout") return authLogout({ baseUrl, authOrigin, store });
  throw new Error(`未知认证命令: ${command ?? args.join(" ")}`);
}

async function authenticatedRuntime(): Promise<CliRuntime> {
  const store = new AuthStore();
  const account = await store.getActiveAccount();
  if (!account) throw new Error("尚未登录，请先执行 pms auth login");
  const auth = new BrowserAuth({ baseUrl: account.baseUrl, authOrigin: originFromBase(account.baseUrl), store });
  const session = await auth.refresh(account);
  return {
    account: session.account,
    client: new PmsHttpClient({
      baseUrl: session.account.baseUrl,
      auth: new StaticTokenProvider(session.accessToken),
      clientId: "pms-cli",
    }),
  };
}

async function runOperation(runtime: CliRuntime, command: string | undefined, args: string[]) {
  const operation = args[0];
  if (!operation) throw new Error("缺少操作名");
  const options = operationOptions(args.slice(1));
  if (command === "preview") return operationPreview(runtime.client, operation, options);
  if (command === "execute") {
    const idempotencyKey = option(args.slice(1), "idempotency-key");
    if (!idempotencyKey) throw new Error("execute 必须提供 --idempotency-key");
    return operationExecute(runtime.client, operation, idempotencyKey, options);
  }
  throw new Error(`未知操作命令: ${command ?? ""}`);
}

function operationOptions(args: string[]) {
  const contextId = option(args, "context-id");
  const contextVersion = option(args, "context-version");
  const contractId = option(args, "contract-id");
  const contractVersion = option(args, "contract-version");
  const argumentsJson = option(args, "arguments-json");
  return {
    arguments: argumentsJson ? JSON.parse(argumentsJson) as Record<string, unknown> : {},
    context: contextId && contextVersion ? { id: contextId, version: contextVersion } : undefined,
    contract: contractId && contractVersion ? { id: contractId, version: contractVersion } : undefined,
    requestId: option(args, "request-id") ?? randomUUID(),
  };
}

function parseFilters(args: string[]) {
  const filters: Record<string, unknown> = {};
  for (const value of args.filter((item) => item.startsWith("--filter="))) {
    const [key, ...parts] = value.slice("--filter=".length).split("=");
    if (key) filters[key] = parts.join("=");
  }
  return filters;
}

function option(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireNumber(command: string | undefined, raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`命令 ${command ?? ""} 需要正整数 ID`);
  return value;
}

function originFromBase(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function formatDoctor(report: ReturnType<typeof doctor>): string {
  return [`Node ${report.node.version} ${report.node.ok ? "OK" : "FAIL"}`, `PMS ${report.baseUrl.value}`, `Skill ${report.skill.ok ? "installed" : "not installed"}`].join("\n");
}

function installSkill(): { installed: string } {
  const source = fileURLToPath(new URL("../skills/pms-project-management/SKILL.md", import.meta.url));
  const destination = join(homedir(), ".codex", "skills", "pms-project-management", "SKILL.md");
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return { installed: destination };
}

main().then((result) => {
  const isRawDoctorJson = process.argv[2] === "doctor" && process.argv.includes("--format") && process.argv.includes("json");
  if (result !== undefined && !isRawDoctorJson) {
    new OutputWriter().success(result, { requestId: randomUUID() });
  }
}).catch((error: unknown) => {
  const writer = new OutputWriter();
  writer.failure({ code: "CLI_ERROR", message: error instanceof Error ? error.message : String(error), requestId: randomUUID() });
});
