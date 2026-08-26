import { z } from 'zod';

import { INCIDENT_FLAG_REASONS } from './moderation.types.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export const incidentFlagParamsSchema = z.strictObject({
  incidentId: z.string().trim().regex(OBJECT_ID, 'incidentId must be a valid ObjectId'),
});

export const submitIncidentFlagBodySchema = z.strictObject({
  clientFlagId: z
    .string()
    .trim()
    .regex(UUID_V4, 'clientFlagId must be a UUIDv4')
    .transform((value) => value.toLowerCase()),
  reason: z.enum(INCIDENT_FLAG_REASONS),
  details: z
    .string()
    .trim()
    .max(500, 'details must contain at most 500 characters')
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional(),
});

export type IncidentFlagParams = z.infer<typeof incidentFlagParamsSchema>;
export type SubmitIncidentFlagInput = z.infer<typeof submitIncidentFlagBodySchema>;
