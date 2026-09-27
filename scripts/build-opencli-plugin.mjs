import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const pluginSourceDir = path.join(repoRoot, "apps", "opencli-plugin");
const outputDir = path.join(repoRoot, "dist", "opencli-plugin");
const commandNames = ["capabilities", "search", "get", "execute", "workflow-action"];

export async function buildOpenCliPlugin() {
  const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await build({
    bundle: true,
    entryPoints: commandNames.map((name) => path.join(pluginSourceDir, `${name}.ts`)),
    external: ["@jackwener/opencli", "@jackwener/opencli/*"],
    format: "esm",
    logLevel: "silent",
    outdir: outputDir,
    platform: "node",
    target: "node22",
  });
  await cp(
    path.join(pluginSourceDir, "opencli-plugin.json"),
    path.join(outputDir, "opencli-plugin.json"),
  );
  await writeFile(
    path.join(outputDir, "package.json"),
    `${JSON.stringify({
      name: "opencli-plugin-pms",
      version: rootPackage.version,
      type: "module",
      engines: { node: ">=22" },
      peerDependencies: { "@jackwener/opencli": ">=1.8.0" },
    }, null, 2)}\n`,
  );
  return outputDir;
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  const directory = await buildOpenCliPlugin();
  console.log(`OpenCLI plugin bundle written to ${directory}`);
}
