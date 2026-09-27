import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  parseCapabilityCatalog,
  type CapabilityCatalog,
} from "../../packages/pms-contracts/src/index.js";

async function loadBackendFixture(): Promise<unknown> {
  return JSON.parse(await readFile(
    new URL("../fixtures/capabilities/backend-missing-label.json", import.meta.url),
    "utf8",
  )) as unknown;
}

describe("capability catalog normalization", () => {
  it("uses input map keys as labels when backend omits action field labels", async () => {
    const catalog = parseCapabilityCatalog(await loadBackendFixture());
    const inputSchema = catalog.resources[0]?.actions[0]?.inputSchema;

    expect(inputSchema?.title).toMatchObject({
      key: "title",
      label: "title",
      type: "string",
      required: true,
      description: "专题名称",
    });
  });

  it("uses field keys for workflow arrays and preserves existing labels", async () => {
    const catalog = parseCapabilityCatalog(await loadBackendFixture());
    const fields = catalog.resources[0]?.workflow?.nodes[0]?.components[0]?.fields;

    expect(fields).toEqual([
      expect.objectContaining({
        key: "report",
        label: "report",
        type: "text",
        required: true,
        enumValues: ["结论一", "结论二"],
      }),
      expect.objectContaining({
        type: "text",
        label: "未命名字段",
        required: false,
      }),
    ]);

    const owner = (catalog.resources[0]?.actions[0]?.inputSchema as CapabilityCatalog["resources"][number]["actions"][number]["inputSchema"] | undefined)?.ownerId;
    expect(owner).toMatchObject({
      label: "负责人",
      type: "integer",
      referenceType: "user",
    });
  });
});
