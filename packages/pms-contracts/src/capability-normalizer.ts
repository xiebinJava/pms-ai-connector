import {
  capabilityCatalogSchema,
  capabilityCatalogWireSchema,
  type CapabilityCatalog,
} from "./capability.js";
import { z } from "zod";

const FALLBACK_FIELD_LABEL = "未命名字段";

type WireCatalog = z.infer<typeof capabilityCatalogWireSchema>;
type WireField = WireCatalog["resources"][number]["actions"][number]["inputSchema"][string];
type WireWorkflow = NonNullable<WireCatalog["resources"][number]["workflow"]>;

function normalizeField(field: WireField, fallbackKey?: string) {
  const key = field.key ?? fallbackKey;
  const label = field.label?.trim() || key || FALLBACK_FIELD_LABEL;

  return {
    ...field,
    ...(key ? { key } : {}),
    label,
  };
}

function normalizeFieldMap(
  fields: Record<string, WireField>,
): Record<string, ReturnType<typeof normalizeField>> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, normalizeField(field, key)]),
  );
}

function normalizeFields(fields: WireWorkflow["nodes"][number]["components"][number]["fields"]) {
  if (Array.isArray(fields)) return fields.map((field) => normalizeField(field));
  return normalizeFieldMap(fields);
}

function normalizeWorkflow(workflow: WireWorkflow) {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      components: node.components.map((component) => ({
        ...component,
        fields: normalizeFields(component.fields),
      })),
    })),
  };
}

export function parseCapabilityCatalog(input: unknown): CapabilityCatalog {
  const wireCatalog = capabilityCatalogWireSchema.parse(input);
  const normalized = {
    ...wireCatalog,
    resources: wireCatalog.resources.map((resource) => ({
      ...resource,
      actions: resource.actions.map((action) => ({
        ...action,
        inputSchema: normalizeFieldMap(action.inputSchema),
      })),
      ...(resource.workflow ? { workflow: normalizeWorkflow(resource.workflow) } : {}),
    })),
    workflowTypes: wireCatalog.workflowTypes.map((workflowType) => ({
      ...workflowType,
      templates: workflowType.templates.map(normalizeWorkflow),
    })),
  };

  return capabilityCatalogSchema.parse(normalized);
}
