import { z } from "zod";

export const commandContractSchema = z.object({
  command: z.string().trim().min(1),
  format: z.enum(["json", "table", "ndjson"]).default("json"),
  success: z.literal("stdout"),
  failure: z.literal("stderr"),
  exitCode: z.number().int().min(1),
});

export const outputMetaSchema = z.object({
  requestId: z.string().trim().min(1),
  clientId: z.string().trim().min(1).default("pms-cli"),
  auditId: z.string().trim().min(1).optional(),
  refreshScopes: z.array(z.string()).default([]),
});

export const outputEnvelopeSchema = z.object({
  ok: z.literal(true),
  data: z.unknown(),
  meta: outputMetaSchema,
});

export const errorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    details: z.record(z.string(), z.unknown()).default({}),
  }),
  meta: z.object({
    requestId: z.string().trim().min(1),
    clientId: z.string().trim().min(1).default("pms-cli"),
  }),
});

export type CommandContract = z.infer<typeof commandContractSchema>;
export type OutputEnvelope<T = unknown> = z.infer<typeof outputEnvelopeSchema> & { data: T };
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
