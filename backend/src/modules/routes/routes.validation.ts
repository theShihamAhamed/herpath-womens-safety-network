import { z } from 'zod';

import { AppError } from '../../common/errors/app-error.js';
import type {
  LatLng,
  RouteRiskScore,
  RouteSummary,
  RouteWithRiskContext,
} from './routes.types.js';

export const destinationSearchQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .min(1, 'Search query must contain at least 1 character')
    .max(100, 'Search query must not exceed 100 characters'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export type DestinationSearchQueryInput = z.infer<typeof destinationSearchQuerySchema>;

export const latLngCoordinateSchema = z.object({
  lat: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  lng: z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
});

export const latLngStringSchema = z
  .string()
  .trim()
  .min(3, 'Coordinate string too short')
  .max(50, 'Coordinate string too long')
  .refine(
    (val) => {
      const parts = val.split(',');
      if (parts.length !== 2) return false;
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      return (
        !Number.isNaN(lat) &&
        !Number.isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    },
    { message: 'Coordinates must be valid "lat,lng" with lat [-90, 90] and lng [-180, 180]' },
  );

export const routeAlternativesQuerySchema = z.strictObject({
  origin: latLngStringSchema,
  destination: latLngStringSchema,
  mode: z.enum(['walking', 'driving', 'bicycling']).optional().default('walking'),
});

export type RouteAlternativesQueryInput = z.infer<typeof routeAlternativesQuerySchema>;

export const routeSummarySchema = z.object({
  routeId: z.string().min(1, 'routeId is required'),
  summaryLabel: z.string().min(1, 'summaryLabel is required'),
  distanceMeters: z.number().nonnegative('distanceMeters must be non-negative'),
  distanceText: z.string().min(1, 'distanceText is required'),
  durationSeconds: z.number().nonnegative('durationSeconds must be non-negative'),
  durationText: z.string().min(1, 'durationText is required'),
  polyline: z.string().min(1, 'polyline geometry is required'),
});

export const routeWithRiskContextSchema = routeSummarySchema.extend({
  sampledPoints: z.array(latLngCoordinateSchema),
  corridorRadiusMeters: z.number().positive('corridorRadiusMeters must be positive'),
  nearbyIncidentCount: z.number().int().nonnegative('nearbyIncidentCount must be non-negative integer'),
  riskEvaluationStatus: z.literal('ready_for_evaluation'),
});

export const routeRiskFactorsSchema = z.object({
  incidentCount: z.number().int().nonnegative('incidentCount must be non-negative integer'),
  severityWeightedScore: z.number().nonnegative('severityWeightedScore must be non-negative'),
  recencyWeightedScore: z.number().nonnegative('recencyWeightedScore must be non-negative'),
});

export const routeRiskScoreSchema = routeWithRiskContextSchema.extend({
  riskScore: z.number().nonnegative('riskScore must be non-negative'),
  riskFactors: routeRiskFactorsSchema,
});

export const routeRecommendationSchema = z.object({
  recommendedRouteId: z.string().min(1, 'recommendedRouteId is required'),
  routes: z.array(routeRiskScoreSchema).min(1, 'At least one route required'),
  explanation: z.string().min(1, 'explanation is required'),
});

/**
 * Parses and strictly validates a "lat,lng" query parameter string.
 * Throws AppError with INVALID_COORDINATES if the value is missing or invalid.
 */
export function parseAndValidateLatLng(value: unknown): LatLng {
  if (typeof value !== 'string') {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_COORDINATES',
      message: 'origin and destination are required as "lat,lng" query params.',
    });
  }

  const parts = value.trim().split(',');
  if (parts.length !== 2) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_COORDINATES',
      message: 'Coordinates must be formatted as "lat,lng".',
    });
  }

  const latStr = parts[0]?.trim();
  const lngStr = parts[1]?.trim();

  if (!latStr || !lngStr) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_COORDINATES',
      message: 'origin and destination are required as "lat,lng" query params.',
    });
  }

  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_COORDINATES',
      message: 'Latitude and longitude must be valid numbers.',
    });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_COORDINATES',
      message: 'Latitude must be between -90 and 90 and longitude between -180 and 180.',
    });
  }

  return { lat, lng };
}

/**
 * Validates a RouteSummary object, returning the strongly typed result or throwing an AppError.
 */
export function validateRouteSummary(data: unknown): RouteSummary {
  const result = routeSummarySchema.safeParse(data);
  if (!result.success) {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_ROUTE_DATA',
      message: 'Route data failed validation requirements.',
      details: result.error.issues,
    });
  }
  return result.data;
}

/**
 * Validates a RouteWithRiskContext object.
 */
export function validateRouteWithRiskContext(data: unknown): RouteWithRiskContext {
  const result = routeWithRiskContextSchema.safeParse(data);
  if (!result.success) {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_ROUTE_DATA',
      message: 'Route with risk context failed validation requirements.',
      details: result.error.issues,
    });
  }
  return result.data as RouteWithRiskContext;
}

/**
 * Validates a RouteRiskScore object.
 */
export function validateRouteRiskScore(data: unknown): RouteRiskScore {
  const result = routeRiskScoreSchema.safeParse(data);
  if (!result.success) {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_ROUTE_DATA',
      message: 'Route risk score failed validation requirements.',
      details: result.error.issues,
    });
  }
  return result.data as RouteRiskScore;
}

