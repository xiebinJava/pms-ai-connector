import { describe, expect, it } from "vitest";
import {
  cleanupScenarioSteps,
  capturesFromScenarioError,
  e2eEnabled,
  loadScenario,
  runAdapterConsistencyCheck,
} from "./helpers.js";

describe("PMS adapter consistency E2E", () => {
  it.skipIf(!e2eEnabled())(
    "returns the same backend result through MCP and OpenCLI",
    async () => {
      const scenario = await loadScenario();
      expect(scenario.adapterConsistency).toBeDefined();

      let captures: Record<string, unknown> = {};
      let primaryFailure: unknown;
      try {
        const execution = await runAdapterConsistencyCheck(scenario.adapterConsistency!);
        captures = execution.captures;
        expect(execution.opencli.status).toBe(execution.mcp.status);
        expect(execution.opencli.data).toEqual(execution.mcp.data);
        expect(execution.opencli.refreshScopes).toEqual(execution.mcp.refreshScopes);
        if (execution.mcp.operationId && execution.opencli.operationId) {
          expect(execution.opencli.operationId).toBe(execution.mcp.operationId);
        }
        if (execution.mcp.auditId && execution.opencli.auditId) {
          expect(execution.opencli.auditId).toBe(execution.mcp.auditId);
        }
      } catch (error) {
        primaryFailure = error;
        captures = capturesFromScenarioError(error) ?? captures;
        throw error;
      } finally {
        try {
          await cleanupScenarioSteps(scenario.cleanup ?? [], captures);
        } catch (cleanupError) {
          if (!primaryFailure) throw cleanupError;
          console.error("PMS E2E 清理失败", cleanupError);
        }
      }
    },
  );
});
