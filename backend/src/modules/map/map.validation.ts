import { z } from 'zod';

const ISO_TIMESTAMP_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const absoluteInstantSchema = z
  .string()
  .trim()
  .regex(
    ISO_TIMESTAMP_WITH_ZONE,
    'must be an ISO-8601 timestamp with Z or an explicit UTC offset',
  )
  .refine((value) => Number.isFinite(Date.parse(value)), 'must be a valid timestamp')
  .transform((value) => new Date(value));

function validateRange(
  query: { occurredFrom?: Date | undefined; occurredTo?: Date | undefined },
  context: z.RefinementCtx,
): void {
  if (query.occurredFrom && query.occurredTo && query.occurredFrom > query.occurredTo) {
    context.addIssue({
      code: 'custom',
      path: ['occurredTo'],
      message: 'occurredTo must be on or after occurredFrom',
    });
  }
}

export const viewportQuerySchema = z.strictObject({
  swLat: z.coerce.number().min(-90).max(90),
  swLng: z.coerce.number().min(-180).max(180),
  neLat: z.coerce.number().min(-90).max(90),
  neLng: z.coerce.number().min(-180).max(180),
  category: z.enum(['HARASSMENT', 'THEFT', 'ASSAULT', 'STALKING', 'OTHER']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  occurredFrom: absoluteInstantSchema.optional(),
  occurredTo: absoluteInstantSchema.optional(),
}).superRefine((query, context) => {
  if (query.swLat >= query.neLat) {
    context.addIssue({ code: 'custom', path: ['neLat'], message: 'neLat must be greater than swLat' });
  }
  if (query.swLng >= query.neLng) {
    context.addIssue({
      code: 'custom',
      path: ['neLng'],
      message: 'neLng must be greater than swLng; wrapped viewports are not supported',
    });
  }
  validateRange(query, context);
});

export const areaSummaryQuerySchema = z.strictObject({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(10000).default(1000),
  occurredFrom: absoluteInstantSchema.optional(),
  occurredTo: absoluteInstantSchema.optional(),
}).superRefine(validateRange);
