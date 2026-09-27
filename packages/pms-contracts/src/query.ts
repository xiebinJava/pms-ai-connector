import { z } from "zod";

/** Resource types currently supported by the PMS read facade. */
export const queryResourceTypeSchema = z.enum([
  "requirement",
  "project",
  "topic",
  "story",
  "task",
  "subtask",
  "iteration_plan",
]);
export type QueryResourceType = z.infer<typeof queryResourceTypeSchema>;

export const workflowResourceTypeSchema = z.enum([
  "requirement",
  "project",
  "topic",
  "story",
]);

export const queryRequestSchema = z.object({
  resourceType: queryResourceTypeSchema,
  keyword: z.string().trim().max(200).optional(),
  filters: z.record(z.unknown()).default({}),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export const queryItemSchema = z.object({
  type: queryResourceTypeSchema,
  id: z.number().int().positive(),
  name: z.string(),
  status: z.string().optional(),
  version: z.number().int().nonnegative().nullable().optional(),
  summary: z.record(z.unknown()).default({}),
});

export const queryResultSchema = z.object({
  resourceType: queryResourceTypeSchema,
  items: z.array(queryItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPage: z.number().int().nonnegative(),
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
  version: number | null;
  currentNode?: {
    id: number | null;
    key: string;
    label: string;
  };
  workflow?: {
    templateVersionId?: number;
    nodes: unknown[];
  };
  allowedActions: string[];
}

export const workflowContextResponseSchema = z.object({
  resourceType: workflowResourceTypeSchema,
  resourceId: z.number().int().positive(),
  version: z.number().int().nonnegative().nullable(),
  currentNode: z.object({
    id: z.number().int().positive().nullable(),
    key: z.string().min(1),
    label: z.string().min(1),
  }).nullable().optional(),
  workflow: z.object({
    templateVersionId: z.number().int().positive().nullable().optional(),
    templateVersionNo: z.number().int().positive().nullable().optional(),
    nodes: z.array(z.unknown()),
  }).nullable().optional(),
  allowedActions: z.array(z.string()).default([]),
}).passthrough();
