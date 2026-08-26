import { z } from 'zod';

import {
  MODERATION_ASSIGNMENT_FILTERS,
  MODERATION_CASE_STATES,
  MODERATION_PRIORITIES,
} from './moderation.types.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

const clientActionIdSchema = z
  .string()
  .trim()
  .regex(UUID_V4, 'clientActionId must be a UUIDv4')
  .transform((value) => value.toLowerCase());

const revisionFields = {
  clientActionId: clientActionIdSchema,
  expectedCaseRevision: z.number().int().min(0),
  expectedLifecycleRevision: z.number().int().min(0),
} as const;

const reasonSchema = z.string().trim().min(1).max(1000);

export const moderationCaseParamsSchema = z.strictObject({
  caseId: z.string().trim().regex(OBJECT_ID, 'caseId must be a valid ObjectId'),
});

export const moderationCaseQueueQuerySchema = z.strictObject({
  state: z.enum(MODERATION_CASE_STATES).optional(),
  priority: z.enum(MODERATION_PRIORITIES).optional(),
  assignment: z.enum(MODERATION_ASSIGNMENT_FILTERS).default('ANY'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().min(1).max(512).optional(),
});

export const claimModerationCaseBodySchema = z.strictObject(revisionFields);

export const releaseModerationCaseBodySchema = z.strictObject({
  ...revisionFields,
  reason: reasonSchema,
});

export const reopenModerationCaseBodySchema = z.strictObject({
  ...revisionFields,
  reason: reasonSchema,
});

export type ModerationCaseParams = z.infer<typeof moderationCaseParamsSchema>;
export type ModerationCaseQueueQuery = z.infer<typeof moderationCaseQueueQuerySchema>;
export type ClaimModerationCaseInput = z.infer<typeof claimModerationCaseBodySchema>;
export type ReleaseModerationCaseInput = z.infer<typeof releaseModerationCaseBodySchema>;
export type ReopenModerationCaseInput = z.infer<typeof reopenModerationCaseBodySchema>;
