import { describe, expect, it } from "vitest";
import {
  readOnlyE2eEnabled,
  runCapabilitiesThroughAdapters,
  runContextThroughAdapters,
  runQueryThroughAdapters,
} from "./helpers.js";

const queryResourceTypes = [
  "requirement",
  "project",
  "topic",
  "story",
  "iteration_plan",
] as const;

describe("PMS readonly integration", () => {
  it.skipIf(!readOnlyE2eEnabled())(
    "keeps dynamic capabilities, resource queries, and workflow contexts consistent across adapters",
    async () => {
      const capabilities = await runCapabilitiesThroughAdapters();
      expect(capabilities.mcp).toEqual(capabilities.opencli);

      const visibleTypes = new Set(capabilities.mcp.resources.map((resource) => resource.type));
      for (const resourceType of queryResourceTypes) {
        expect(visibleTypes.has(resourceType)).toBe(true);
        const result = await runQueryThroughAdapters({ resourceType, page: 1, pageSize: 1 });
        expect(result.mcp).toEqual(result.opencli);
      }

      const topicQuery = await runQueryThroughAdapters({ resourceType: "topic", page: 1, pageSize: 1 });
      const storyQuery = await runQueryThroughAdapters({ resourceType: "story", page: 1, pageSize: 1 });
      const topicId = Number(process.env.PMS_E2E_TOPIC_ID ?? topicQuery.mcp.items[0]?.id);
      const storyId = Number(process.env.PMS_E2E_STORY_ID ?? storyQuery.mcp.items[0]?.id);
      if (!Number.isInteger(topicId) || topicId <= 0) {
        throw new Error("只读验收需要专题数据，请设置 PMS_E2E_TOPIC_ID");
      }
      if (!Number.isInteger(storyId) || storyId <= 0) {
        throw new Error("只读验收需要故事数据，请设置 PMS_E2E_STORY_ID");
      }

      const topicContext = await runContextThroughAdapters({ type: "topic", id: topicId });
      const storyContext = await runContextThroughAdapters({ type: "story", id: storyId });
      expect(topicContext.mcp).toEqual(topicContext.opencli);
      expect(storyContext.mcp).toEqual(storyContext.opencli);
    },
  );
});
