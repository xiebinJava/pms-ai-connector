import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadScenario } from "./helpers.js";

describe("PMS E2E scenario safety", () => {
  it("rejects an explicitly enabled write scenario without cleanup", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pms-ai-connector-"));
    const file = join(directory, "unsafe.json");
    try {
      await writeFile(file, JSON.stringify({ steps: [{ operation: "project.create" }] }));

      await expect(loadScenario({
        PMS_E2E_WRITE: "true",
        PMS_E2E_SCENARIO_FILE: file,
      })).rejects.toThrow("cleanup");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
