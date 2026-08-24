import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../common/errors/app-error.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import type { GeocodingService } from './geocoding.service.js';
import { getRouteAlternatives } from './routeAlternatives.service.js';
import { prepareRoutesForRiskEvaluation } from './routeRisk.service.js';
import type { RouteAlternativesRequest } from './routes.types.js';
import type { DestinationSearchQueryInput } from './routes.validation.js';

export class RoutesController {
  public constructor(private readonly geocodingService: GeocodingService) {}

  public searchDestinations = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = request.query as unknown as DestinationSearchQueryInput;
      const destinations = await this.geocodingService.searchPlaces(query);
      sendSuccess(response, destinations);
    } catch (error) {
      next(error);
    }
  };
}

function parseLatLng(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split(',');
  const latStr = parts[0];
  const lngStr = parts[1];
  if (!latStr || !lngStr) return null;
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * GET /api/v1/routes/alternatives?origin=lat,lng&destination=lat,lng&mode=walking
 *
 * HS-119 → HS-122: fetch alternatives → format distance/time → prep risk-evaluation context.
 */
export async function getAlternativeRoutes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const origin = parseLatLng(req.query.origin);
  const destination = parseLatLng(req.query.destination);
  const mode = (req.query.mode as RouteAlternativesRequest['mode']) ?? 'walking';

  if (!origin || !destination) {
    next(
      new AppError({
        statusCode: 400,
        code: 'INVALID_COORDINATES',
        message: 'origin and destination are required as "lat,lng" query params.',
      }),
    );
    return;
  }

  try {
    const routes = await getRouteAlternatives({ origin, destination, mode });
    const routesWithRiskContext = await prepareRoutesForRiskEvaluation(routes);
    sendSuccess(res, { count: routesWithRiskContext.length, routes: routesWithRiskContext });
  } catch (err) {
    next(err);
  }
}
