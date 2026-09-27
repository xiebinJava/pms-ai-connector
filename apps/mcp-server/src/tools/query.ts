import * as z from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { PmsClient } from "../../../../packages/pms-client/src/index.js";
import { toolFailure, toolSuccess } from "./result.js";

const queryResourceTypes = [
  "requirement", "project", "topic", "story", "task", "subtask", "iteration_plan",
] as const;

export const searchInputSchema = z.object({
  resourceType: z.enum(queryResourceTypes),
  keyword: z.string().trim().max(200).optional(),
  filters: z.record(z.string(), z.unknown()).default({}),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export const resourceContextInputSchema = z.object({
  resourceType: z.enum(["requirement", "project", "topic", "story"]),
  resourceId: z.number().int().positive(),
});

export type SearchInput = z.infer<typeof searchInputSchema>;
export type ResourceContextInput = z.infer<typeof resourceContextInputSchema>;

export async function searchTool(client: PmsClient, input: unknown): Promise<CallToolResult> {
  try {
    const value = searchInputSchema.parse(input);
    const result = await client.query(value);
    return toolSuccess(result);
  } catch (error) {
    return toolFailure(error);
  }
}

export async function getContextTool(client: PmsClient, input: unknown): Promise<CallToolResult> {
  try {
    const value = resourceContextInputSchema.parse(input);
    const result = await client.context({ type: value.resourceType, id: value.resourceId });
    return toolSuccess(result);
  } catch (error) {
    return toolFailure(error);
  }
}
