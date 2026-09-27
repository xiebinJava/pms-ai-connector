import { z } from "zod";

export const errorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
]);

export const pmsErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1),
  requestId: z.string().min(1).optional(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type PmsError = z.infer<typeof pmsErrorSchema>;
