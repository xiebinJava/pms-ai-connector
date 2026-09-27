import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface DoctorReport {
  node: { ok: boolean; version: string; minimum: string };
  baseUrl: { ok: boolean; value: string; source: string };
  credentials: { ok: boolean; source: string };
  skill: { ok: boolean; path: string };
}

export function doctor(env: NodeJS.ProcessEnv = process.env): DoctorReport {
  const baseUrl = env.PMS_BASE_URL?.trim() || "http://localhost:5173/api";
  const version = process.versions.node;
  const major = Number(version.split(".")[0]);
  const skillPath = join(homedir(), ".codex", "skills", "pms-project-management", "SKILL.md");
  return {
    node: { ok: Number.isFinite(major) && major >= 22, version, minimum: ">=22" },
    baseUrl: { ok: Boolean(baseUrl), value: baseUrl, source: env.PMS_BASE_URL ? "PMS_BASE_URL" : "default" },
    credentials: { ok: Boolean(env.PMS_REFRESH_TOKEN), source: env.PMS_REFRESH_TOKEN ? "PMS_REFRESH_TOKEN" : "OS keyring" },
    skill: { ok: existsSync(skillPath), path: skillPath },
  };
}
