import { describe, expect, it } from "vitest";
import {
  cleanupScenarioSteps,
  capturesFromScenarioError,
  e2eEnabled,
  loadScenario,
  runConcurrentSteps,
  runIdempotencyCheck,
} from "./helpers.js";

describe("PMS concurrency and idempotency E2E", () => {
  it.skipIf(!e2eEnabled())(
    "returns the same operation result for a repeated idempotency key",
    async () => {
      const scenario = await loadScenario();
      expect(scenario.idempotency).toBeDefined();

      let captures: Record<string, unknown> = {};
      let primaryFailure: unknown;
      try {
        const execution = await runIdempotencyCheck(scenario.idempotency!);
        captures = execution.captures;
        expect(execution.second).toEqual(execution.first);
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

  it.skipIf(!e2eEnabled())(
    "keeps optimistic concurrency errors visible when two updates race",
    async () => {
      const scenario = await loadScenario();
      expect(scenario.concurrency).toBeDefined();

      let captures: Record<string, unknown> = {};
      let primaryFailure: unknown;
      try {
        const execution = await runConcurrentSteps(scenario.concurrency!.steps);
        captures = execution.captures;
        const errors = execution.outcomes.flatMap((outcome) => outcome.error ? [outcome.error] : []);
        expect(errors.length).toBeGreaterThanOrEqual(1);
        if (scenario.concurrency!.expectedKind) {
          expect(errors.some((error) => error.kind === scenario.concurrency!.expectedKind)).toBe(true);
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
