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
        expect(execution.opencli.message).toBe(execution.mcp.message);
        expect(execution.opencli.data).toMatchObject({
          project: {
            name: expect.stringContaining("PMS AI Connector adapter"),
            description: "MCP 与 OpenCLI 结果一致性验收",
            priority: 1,
          },
        });
        expect(execution.mcp.data).toMatchObject({
          project: {
            name: expect.stringContaining("PMS AI Connector adapter"),
            description: "MCP 与 OpenCLI 结果一致性验收",
            priority: 1,
          },
        });
        expect(execution.captures.projectId).not.toBe(execution.captures.opencliProjectId);
        expect(execution.opencli.refreshScopes).toEqual(execution.mcp.refreshScopes);
        expect(execution.mcp.operationId).toEqual(expect.any(String));
        expect(execution.opencli.operationId).toEqual(expect.any(String));
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
