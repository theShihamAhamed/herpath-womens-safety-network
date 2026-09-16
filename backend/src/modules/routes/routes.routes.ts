import { Router } from 'express';

import { validate } from '../../common/middleware/validate.js';
import { GeocodingService } from './geocoding.service.js';
import { getRouteRecommendationHandler } from './recommendation.controller.js';
import { getAlternativeRoutes, RoutesController } from './routes.controller.js';
import { destinationDetailsQuerySchema, destinationSearchQuerySchema } from './routes.validation.js';

export function createRoutesRouter(options: { geocodingService?: GeocodingService; googlePlacesApiKey?: string | undefined } = {}): Router {
  const router = Router();
  const service = options.geocodingService ?? new GeocodingService(options.googlePlacesApiKey);
  const controller = new RoutesController(service);

  // HS-119–HS-122: Destination search
  router.get(
    '/destinations/search',
    validate({ query: destinationSearchQuerySchema }),
    controller.searchDestinations,
  );
  router.get('/destinations/details', validate({ query: destinationDetailsQuerySchema }), controller.getDestinationDetails);

  // HS-119–HS-122: Fetch alternative routes with risk context
  router.get('/alternatives', getAlternativeRoutes);

  // HS-88 → HS-87 → HS-86: Full recommendation pipeline
  router.get('/recommendation', getRouteRecommendationHandler);

  return router;
}
