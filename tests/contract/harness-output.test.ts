import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("CLI-Anything harness output", () => {
  it("describes an API-backed command map without GUI automation", async () => {
    const raw = await readFile(new URL("../../.cli-anything/command-map.json", import.meta.url), "utf8");
    const map = JSON.parse(raw) as { binary: string; transport: string; commands: Array<{ name: string }> };

    expect(map.binary).toBe("pms");
    expect(map.transport).toBe("pms-http-api");
    expect(map.commands.map((command) => command.name)).toEqual(expect.arrayContaining([
      "capabilities",
      "operation preview",
      "operation execute",
      "context",
    ]));
    expect(raw.toLowerCase()).not.toContain("playwright");
  });

  it("gives an agent dynamic discovery and safe write guidance", async () => {
    const skill = await readFile(new URL("../../skills/pms-project-management/SKILL.md", import.meta.url), "utf8");

    expect(skill).toContain("pms capabilities --format json");
    expect(skill).toContain("pms context");
    expect(skill).toContain("pms operation preview");
    expect(skill).toContain("idempotency");
  });
});
