import { describe, expect, it } from "vitest";
import {
  e2eEnabled,
  loadScenario,
  runInvalidRelationCases,
} from "./helpers.js";

describe("PMS invalid relation E2E", () => {
  it.skipIf(!e2eEnabled())(
    "lets PMS reject the configured invalid relation cases with stable error kinds",
    async () => {
      const scenario = await loadScenario();
      const cases = scenario.invalidRelations ?? [];
      expect(cases.length).toBeGreaterThan(0);

      const results = await runInvalidRelationCases(cases);
      for (const result of results) {
        expect(result.error.kind).toBe(result.expectedKind);
      }
    },
  );
});
