import { z } from 'zod';

import type { JourneyOutcome } from './journey.types.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const journeyIdSchema = z.string().trim().regex(OBJECT_ID, 'journeyId must be a valid MongoDB ObjectId');

const coordinateFields = {
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
};

const locationPointSchema = z.strictObject({
  ...coordinateFields,
  address: z.string().trim().min(1).max(256).optional(),
});

export const startJourneyBodySchema = z.strictObject({
  routeId: z.string().trim().min(1).max(256),
  origin: locationPointSchema,
  destination: locationPointSchema,
  polyline: z.string().trim().min(1).max(100_000),
  distance: z.number().finite().nonnegative().optional(),
  duration: z.number().finite().nonnegative().optional(),
  riskScore: z.number().finite().nonnegative().optional(),
});

export const journeyIdBodySchema = z.strictObject({ journeyId: journeyIdSchema });

export const journeyCoordinateBodySchema = z.strictObject({
  journeyId: journeyIdSchema,
  ...coordinateFields,
});

export const journeyOutcomeBodySchema = z.strictObject({
  journeyId: journeyIdSchema,
  outcome: z.enum(['SAFE_CONFIRMED', 'INCIDENT_REPORTED', 'UNKNOWN'] satisfies JourneyOutcome[]),
});

export const journeyIdParamsSchema = z.strictObject({ id: journeyIdSchema });
export const emptyQuerySchema = z.strictObject({});

export type StartJourneyBody = z.infer<typeof startJourneyBodySchema>;
export type JourneyIdBody = z.infer<typeof journeyIdBodySchema>;
export type JourneyCoordinateBody = z.infer<typeof journeyCoordinateBodySchema>;
export type JourneyOutcomeBody = z.infer<typeof journeyOutcomeBodySchema>;
export type JourneyIdParams = z.infer<typeof journeyIdParamsSchema>;
