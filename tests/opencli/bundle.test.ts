import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenCliPlugin } from "../../scripts/build-opencli-plugin.mjs";

describe("OpenCLI release bundle", () => {
  it("contains flat runnable commands without workspace dependencies", async () => {
    const outputDir = await buildOpenCliPlugin();
    const packageJson = JSON.parse(await readFile(path.join(outputDir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const manifest = JSON.parse(await readFile(path.join(outputDir, "opencli-plugin.json"), "utf8")) as {
      name: string;
    };

    expect(manifest.name).toBe("pms");
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.peerDependencies?.["@jackwener/opencli"]).toBe(">=1.8.0");
    for (const command of ["capabilities", "search", "get", "execute", "workflow-action"]) {
      const source = await readFile(path.join(outputDir, `${command}.js`), "utf8");
      expect(source).not.toContain("workspace:");
      expect(source).not.toContain("../../packages/");
      expect(source).toContain("@jackwener/opencli/registry");
    }
  });
});
