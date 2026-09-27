import { z } from "zod";

export const resourceTypeSchema = z.enum([
  "requirement",
  "project",
  "project_node",
  "topic",
  "topic_node",
  "story",
  "story_node",
  "task",
  "subtask",
  "iteration_plan",
  "workflow_template",
  "user",
]);

export type ResourceType = z.infer<typeof resourceTypeSchema>;

export const resourceRefSchema = z.object({
  type: resourceTypeSchema,
  id: z.number().int().positive().optional(),
});

export const operationContextSchema = z.object({
  id: z.string().trim().min(1),
  version: z.string().trim().min(1),
});

export const operationContractSchema = z.object({
  id: z.string().trim().min(1),
  version: z.string().trim().min(1),
});

export type OperationContract = z.infer<typeof operationContractSchema>;

export const automaticOperationRequestSchema = z.object({
  operation: z.string().trim().min(1).max(160),
  arguments: z.record(z.unknown()).default({}),
  context: operationContextSchema.optional(),
  contract: operationContractSchema.optional(),
  idempotencyKey: z.string().trim().min(1).max(160),
  clientId: z.enum(["mcp", "opencli"]),
  requestId: z.string().trim().min(1).max(160),
});

export type AutomaticOperationRequest = z.infer<typeof automaticOperationRequestSchema>;

export const operationStatusSchema = z.enum(["SUCCEEDED", "REJECTED", "CONFLICT"]);

export const operationResultSchema = z.object({
  operationId: z.string().trim().min(1),
  status: operationStatusSchema,
  message: z.string().optional(),
  data: z.record(z.unknown()).default({}),
  warnings: z.array(z.string()).default([]),
  refreshScopes: z.array(z.string()).default([]),
  auditId: z.string().trim().min(1).optional(),
});

export type OperationResult = z.infer<typeof operationResultSchema>;
