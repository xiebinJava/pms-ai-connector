import { z } from "zod";
import { resourceTypeSchema } from "./operation.js";

export const capabilityRiskSchema = z.enum(["low", "medium", "high"]);
export const executionModeSchema = z.enum(["read", "automatic"]);

export const fieldSchema = z.object({
  key: z.string().min(1).optional(),
  type: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().default(false),
  description: z.string().optional(),
  format: z.string().optional(),
  enumValues: z.array(z.unknown()).optional(),
  referenceType: resourceTypeSchema.optional(),
  options: z.array(z.string()).optional(),
  visible: z.boolean().optional(),
  binding: z.string().optional(),
  fullWidth: z.boolean().optional(),
}).passthrough();

export const actionCapabilitySchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  mode: executionModeSchema,
  risk: capabilityRiskSchema,
  scopes: z.array(z.string()),
  inputSchema: z.record(z.string(), fieldSchema),
  requiresContext: z.boolean(),
  refreshScopes: z.array(z.string()),
});

export const workflowComponentSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  fields: z.union([z.record(z.string(), fieldSchema), z.array(fieldSchema)]),
  actions: z.array(z.string()).default([]),
});

export const workflowNodeSchema = z.object({
  id: z.number().int().positive().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  position: z.number().int().nonnegative(),
  components: z.array(workflowComponentSchema),
});

export const workflowCapabilitySchema = z.object({
  templateVersionId: z.number().int().positive().optional(),
  templateVersion: z.string().optional(),
  versionNo: z.number().int().positive().optional(),
  name: z.string().optional(),
  defaultTemplate: z.boolean().optional(),
  nodes: z.array(workflowNodeSchema),
});

export const workflowTypeCapabilitySchema = z.object({
  processType: z.string().min(1),
  label: z.string().min(1),
  templates: z.array(workflowCapabilitySchema),
});

export const resourceCapabilitySchema = z.object({
  type: resourceTypeSchema,
  actions: z.array(actionCapabilitySchema),
  workflow: workflowCapabilitySchema.optional(),
});

export const capabilityCatalogSchema = z.object({
  version: z.string().min(1),
  resources: z.array(resourceCapabilitySchema),
  scopes: z.array(z.string()),
  workflowTypes: z.array(workflowTypeCapabilitySchema).default([]),
  viewer: z.object({
    id: z.number().int().positive(),
    displayName: z.string().min(1),
    username: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  today: z.string().optional(),
}).passthrough();

export type FieldSchema = z.infer<typeof fieldSchema>;
export type ActionCapability = z.infer<typeof actionCapabilitySchema>;
export type WorkflowComponent = z.infer<typeof workflowComponentSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowCapability = z.infer<typeof workflowCapabilitySchema>;
export type WorkflowTypeCapability = z.infer<typeof workflowTypeCapabilitySchema>;
export type ResourceCapability = z.infer<typeof resourceCapabilitySchema>;
export type CapabilityCatalog = z.infer<typeof capabilityCatalogSchema>;
