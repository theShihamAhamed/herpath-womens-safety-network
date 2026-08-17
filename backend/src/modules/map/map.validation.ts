import { z } from 'zod';

export const viewportQuerySchema = z.object({
  swLat: z.coerce.number().min(-90).max(90),
  swLng: z.coerce.number().min(-180).max(180),
  neLat: z.coerce.number().min(-90).max(90),
  neLng: z.coerce.number().min(-180).max(180),
  category: z.enum(['HARASSMENT', 'THEFT', 'ASSAULT', 'STALKING', 'OTHER']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  startHour: z.coerce.number().int().min(0).max(23).optional(),
  endHour: z.coerce.number().int().min(0).max(23).optional(),
}).superRefine((query, context) => {
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    context.addIssue({ code: 'custom', path: ['dateTo'], message: 'dateTo must be on or after dateFrom' });
  }
});

export const areaSummaryQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(10000).default(1000),
});
