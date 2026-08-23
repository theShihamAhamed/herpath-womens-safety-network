import { Router } from 'express';

import { validate } from '../../common/middleware/validate.js';
import { GeocodingService } from './geocoding.service.js';
import { RoutesController } from './routes.controller.js';
import { destinationSearchQuerySchema } from './routes.validation.js';

export function createRoutesRouter(geocodingService?: GeocodingService): Router {
  const router = Router();
  const service = geocodingService ?? new GeocodingService();
  const controller = new RoutesController(service);

  router.get(
    '/destinations/search',
    validate({ query: destinationSearchQuerySchema }),
    controller.searchDestinations,
  );

  return router;
}
