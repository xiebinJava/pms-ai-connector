import { describe, expect, it } from "vitest";
import type { CapabilityCatalog } from "../../packages/pms-contracts/src/index.js";
import { CapabilityResolver } from "../../apps/pms-cli/src/capabilities/CapabilityResolver.js";

const catalog: CapabilityCatalog = {
  version: "ai-v1",
  resources: [{
    type: "project",
    actions: [{
      name: "project.update",
      label: "更新项目",
      description: "更新项目",
      mode: "automatic",
      risk: "medium",
      scopes: [],
      inputSchema: {
        name: { type: "string", label: "项目名称", required: true },
        level: { type: "string", label: "项目等级", options: ["S", "A"], required: false },
      },
      requiresContext: true,
      refreshScopes: [],
    }],
  }],
  scopes: [],
  workflowTypes: [],
};

describe("dynamic action field validation", () => {
  it("uses required and option metadata from the capability catalog", async () => {
    const resolver = new CapabilityResolver({ capabilities: async () => catalog } as never);
    await resolver.list();

    expect(() => resolver.validateArguments("project.update", {})).toThrow("name");
    expect(() => resolver.validateArguments("project.update", { name: "PMS", level: "C" }))
      .toThrow("level");
    expect(resolver.validateArguments("project.update", { name: "PMS", level: "A" }))
      .toEqual({ name: "PMS", level: "A" });
  });
});
