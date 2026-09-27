import { z } from "zod";
import { resourceTypeSchema } from "./operation.js";

export const queryRequestSchema = z.object({
  resourceType: resourceTypeSchema,
  keyword: z.string().trim().max(200).optional(),
  filters: z.record(z.unknown()).default({}),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(200).default(20),
});

export const queryItemSchema = z.object({
  type: resourceTypeSchema,
  id: z.number().int().positive(),
  name: z.string(),
  status: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  summary: z.record(z.unknown()).default({}),
});

export const queryResultSchema = z.object({
  resourceType: resourceTypeSchema,
  items: z.array(queryItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  queryScope: z.string().min(1),
});

export type QueryRequest = z.infer<typeof queryRequestSchema>;
export type QueryItem = z.infer<typeof queryItemSchema>;
export type QueryResult = z.infer<typeof queryResultSchema>;

export interface ResourceRef {
  type: QueryItem["type"];
  id: number;
}

export interface WorkflowContext {
  resource: ResourceRef;
  version: number;
  currentNode?: {
    id: number;
    key: string;
    label: string;
  };
  workflow?: {
    templateVersionId?: number;
    nodes: unknown[];
  };
  allowedActions: string[];
}
