import { z } from 'zod';

import { FEEDBACK_RESPONSES } from './community-verification.types.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export const incidentFeedbackParamsSchema = z.strictObject({
  incidentId: z.string().trim().regex(OBJECT_ID, 'incidentId must be a valid ObjectId'),
});

export const submitFeedbackBodySchema = z.strictObject({
  clientFeedbackId: z
    .string()
    .trim()
    .regex(UUID_V4, 'clientFeedbackId must be a UUIDv4')
    .transform((value) => value.toLowerCase()),
  response: z.enum(FEEDBACK_RESPONSES),
});

export type IncidentFeedbackParams = z.infer<typeof incidentFeedbackParamsSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackBodySchema>;
