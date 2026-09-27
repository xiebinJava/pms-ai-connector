import { describe, expect, it } from "vitest";
import { dashboardSummary } from "../../apps/pms-cli/src/commands/shortcuts/dashboard.js";
import { getContext } from "../../apps/pms-cli/src/commands/core/context.js";
import { listCapabilities } from "../../apps/pms-cli/src/commands/core/capabilities.js";
import { search } from "../../apps/pms-cli/src/commands/core/search.js";
import { PmsHttpClient, StaticTokenProvider } from "../../packages/pms-client/src/index.js";

const enabled = process.env.PMS_E2E_READONLY === "true"
  && Boolean(process.env.PMS_E2E_BASE_URL)
  && Boolean(process.env.PMS_E2E_TOKEN);

describe.skipIf(!enabled)("PMS CLI real service closed loop", () => {
  it("reads capabilities, projects, dashboard and a workflow context from the running PMS", async () => {
    const client = new PmsHttpClient({
      baseUrl: process.env.PMS_E2E_BASE_URL!,
      auth: new StaticTokenProvider(process.env.PMS_E2E_TOKEN!),
      clientId: "pms-cli",
    });
    const capabilities = await listCapabilities(client);
    expect(capabilities.version).toBeTruthy();
    expect(capabilities.resources.length).toBeGreaterThan(0);
    for (const resource of capabilities.resources) {
      for (const action of resource.actions) {
        expect(action.name).toBeTruthy();
        expect(Object.keys(action.inputSchema)).not.toContain("");
      }
    }

    const projects = await search(client, { resourceType: "project", page: 1, pageSize: 20, filters: {} });
    const dashboard = await dashboardSummary(client);
    expect(dashboard.projectTotal).toBe(projects.total);

    const projectId = Number(process.env.PMS_E2E_PROJECT_ID ?? projects.items[0]?.id);
    if (Number.isInteger(projectId) && projectId > 0) {
      const context = await getContext(client, "project", projectId);
      expect(context.resource).toEqual({ type: "project", id: projectId });
    }
  });
});
