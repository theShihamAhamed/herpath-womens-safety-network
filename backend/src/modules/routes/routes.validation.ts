import { z } from 'zod';

export const destinationSearchQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .min(2, 'Search query must contain at least 2 characters')
    .max(100, 'Search query must not exceed 100 characters'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export type DestinationSearchQueryInput = z.infer<typeof destinationSearchQuerySchema>;
