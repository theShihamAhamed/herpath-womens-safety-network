import { z } from 'zod';

import { INCIDENT_CATEGORIES, INCIDENT_SEVERITIES } from './incident.types.js';
import { isResolution8Cell } from './location-privacy.service.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;

const clientSubmissionIdSchema = z
  .string()
  .trim()
  .regex(UUID_V4, 'clientSubmissionId must be a UUIDv4')
  .transform((value) => value.toLowerCase());

const occurredAtSchema = z
  .string()
  .trim()
  .regex(
    ISO_TIMESTAMP_WITH_ZONE,
    'occurredAt must be an ISO-8601 timestamp with Z or an explicit UTC offset',
  )
  .refine((value) => Number.isFinite(Date.parse(value)), 'occurredAt must be a valid timestamp')
  .transform((value) => new Date(value))
  .refine(
    (value) => value.getTime() <= Date.now() + MAX_FUTURE_SKEW_MS,
    'occurredAt cannot be more than 5 minutes in the future',
  );

const descriptionSchema = z
  .string()
  .trim()
  .max(500, 'description must contain at most 500 characters')
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

const geoJsonPointSchema = z.strictObject({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
  ]),
});

const exactPrivateLocationSchema = z.strictObject({
  mode: z.literal('EXACT_PRIVATE'),
  privateLocation: geoJsonPointSchema,
});

const approximateOnlyLocationSchema = z.strictObject({
  mode: z.literal('APPROXIMATE_ONLY'),
  selectedAreaCellId: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .refine(isResolution8Cell, 'selectedAreaCellId must be a valid H3 resolution 8 cell'),
});

export const createIncidentBodySchema = z.strictObject({
  clientSubmissionId: clientSubmissionIdSchema,
  category: z.enum(INCIDENT_CATEGORIES),
  severity: z.enum(INCIDENT_SEVERITIES),
  occurredAt: occurredAtSchema,
  description: descriptionSchema,
  location: z.discriminatedUnion('mode', [
    exactPrivateLocationSchema,
    approximateOnlyLocationSchema,
  ]),
});

export const locationCellsQuerySchema = z
  .strictObject({
    north: z.coerce.number().finite().min(-90).max(90),
    south: z.coerce.number().finite().min(-90).max(90),
    east: z.coerce.number().finite().min(-180).max(180),
    west: z.coerce.number().finite().min(-180).max(180),
  })
  .superRefine((viewport, context) => {
    if (viewport.north <= viewport.south) {
      context.addIssue({
        code: 'custom',
        path: ['north'],
        message: 'north must be greater than south',
      });
    }
    if (viewport.east <= viewport.west) {
      context.addIssue({
        code: 'custom',
        path: ['east'],
        message: 'east must be greater than west; wrapped viewports are not supported',
      });
    }
    if (viewport.north - viewport.south > 0.1 + Number.EPSILON) {
      context.addIssue({
        code: 'custom',
        path: ['north'],
        message: 'latitude span must not exceed 0.1 degrees',
      });
    }
    if (viewport.east - viewport.west > 0.1 + Number.EPSILON) {
      context.addIssue({
        code: 'custom',
        path: ['east'],
        message: 'longitude span must not exceed 0.1 degrees',
      });
    }
  });

export const mineQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().min(1).max(512).optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentBodySchema>;
export type LocationCellsQuery = z.infer<typeof locationCellsQuerySchema>;
export type MineQuery = z.infer<typeof mineQuerySchema>;
