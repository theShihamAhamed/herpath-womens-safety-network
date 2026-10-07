import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { GeocodingService } from './geocoding.service.js';
import { getRouteAlternatives } from './routeAlternatives.service.js';
import { prepareRoutesForRiskEvaluation } from './routeRisk.service.js';
import type { RouteAlternativesRequest } from './routes.types.js';
import type { DestinationSearchQuery } from './routes.types.js';
import { parseAndValidateLatLng, validateRouteWithRiskContext } from './routes.validation.js';

export class RoutesController {
  public constructor(private readonly geocodingService: GeocodingService) {}

  public searchDestinations = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = request.query as unknown as DestinationSearchQuery;
      const destinations = await this.geocodingService.searchPlaces(query);
      sendSuccess(response, destinations);
    } catch (error) {
      next(error);
    }
  };
}

export async function getAlternativeRoutes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const origin = parseAndValidateLatLng(req.query.origin);
    const destination = parseAndValidateLatLng(req.query.destination);
    const mode = (req.query.mode as RouteAlternativesRequest['mode']) ?? 'walking';

    const routes = await getRouteAlternatives({ origin, destination, mode });
    const routesWithRiskContext = await prepareRoutesForRiskEvaluation(routes);
    const validatedRoutes = routesWithRiskContext.map(validateRouteWithRiskContext);

    sendSuccess(res, { count: validatedRoutes.length, routes: validatedRoutes });
  } catch (err) {
    next(err);
  }
}

