import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { GeocodingService } from './geocoding.service.js';
import type { DestinationSearchQueryInput } from './routes.validation.js';
import { getRouteAlternatives } from './routeAlternatives.service.js';
import { prepareRoutesForRiskEvaluation } from './routeRisk.service.js';
import type { RouteAlternativesRequest } from './routes.types.js';

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

/**
 * This controller assumes your common/utils response helpers and
 * common/errors classes exist. Swap the res.json(...) calls below for your
 * real helpers if they differ, e.g.:
 *
 *   import { sendSuccess } from '../../common/utils/response';
 *   import { BadRequestError } from '../../common/errors';
 *
 * and swap the manual 400/502 responses for `next(new BadRequestError(...))`
 * so your common error-handling middleware formats it consistently.
 */

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
 * GET /api/routes/alternatives?origin=lat,lng&destination=lat,lng&mode=walking
 *
 * Covers HS-119 -> HS-122 end to end:
 * fetch alternatives -> format distance/time -> prep risk-evaluation context.
 */
export async function getAlternativeRoutes(
  req: Request,
  res: Response
) {
  const origin = parseLatLng(req.query.origin);
  const destination = parseLatLng(req.query.destination);
  const mode = (req.query.mode as RouteAlternativesRequest['mode']) ?? 'walking';

  if (!origin || !destination) {
    return res.status(400).json({
      success: false,
      error: 'origin and destination are required as "lat,lng" query params.',
    });
  }

  try {
    const routes = await getRouteAlternatives({ origin, destination, mode });
    const routesWithRiskContext = await prepareRoutesForRiskEvaluation(routes);

    return res.status(200).json({
      success: true,
      data: {
        count: routesWithRiskContext.length,
        routes: routesWithRiskContext,
      },
    });
  } catch (err) {
    // Prefer forwarding to your common error-handling middleware:
    //   return next(err);
    const message = err instanceof Error ? err.message : 'Failed to fetch routes.';
    return res.status(502).json({ success: false, error: message });
  }
}
