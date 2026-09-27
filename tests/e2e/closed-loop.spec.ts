import { describe, expect, it } from "vitest";
import {
  cleanupScenarioSteps,
  capturesFromScenarioError,
  e2eEnabled,
  loadScenario,
  runCapabilitiesThroughAdapters,
  runQueryThroughAdapters,
  runScenarioSteps,
} from "./helpers.js";

describe("PMS closed-loop E2E", () => {
  it.skipIf(!e2eEnabled())(
    "discovers the live workflow and completes the configured requirement-to-iteration scenario",
    async () => {
      const scenario = await loadScenario();
      expect(scenario.steps.length).toBeGreaterThan(0);

      const capabilities = await runCapabilitiesThroughAdapters();
      expect(capabilities.mcp).toEqual(capabilities.opencli);

      let captures: Record<string, unknown> | undefined;
      let primaryFailure: unknown;
      try {
        captures = await runScenarioSteps(scenario.steps);

        for (const assertion of scenario.assertions ?? []) {
          const result = await runQueryThroughAdapters(assertion, captures);
          expect(result.mcp).toEqual(result.opencli);
        }
      } catch (error) {
        primaryFailure = error;
        captures = capturesFromScenarioError(error) ?? captures;
        throw error;
      } finally {
        try {
          await cleanupScenarioSteps(scenario.cleanup ?? [], captures ?? {});
        } catch (cleanupError) {
          if (!primaryFailure) throw cleanupError;
          console.error("PMS E2E 清理失败", cleanupError);
        }
      }
    },
  );
});
