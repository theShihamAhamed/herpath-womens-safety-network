import { Router } from 'express';

import { validate } from '../../common/middleware/validate.js';
import { MapController } from './map.controller.js';
import { MapService } from './map.service.js';
import { OverpassSupportPlaceProvider } from './overpass-support-place.provider.js';
import type { SupportPlaceProvider } from './support-place.provider.js';
import { SupportPlaceService } from './support-place.service.js';
import { areaSummaryQuerySchema, supportPlaceQuerySchema, viewportQuerySchema } from './map.validation.js';

export function createMapRouter(options: {
  overpassApiUrl?: string;
  supportPlaceProvider?: SupportPlaceProvider;
} = {}): Router {
  const router = Router();
  const service = new MapService();
  const supportPlaceService = new SupportPlaceService(
    options.supportPlaceProvider ?? new OverpassSupportPlaceProvider(options.overpassApiUrl),
  );
  const controller = new MapController(service, supportPlaceService);

  router.get(
    '/incidents',
    validate({ query: viewportQuerySchema }),
    controller.getIncidents,
  );

  router.get(
    '/area-summary',
    validate({ query: areaSummaryQuerySchema }),
    controller.getAreaSummary,
  );

  router.get(
    '/support-places',
    validate({ query: supportPlaceQuerySchema }),
    controller.getSupportPlaces,
  );

  return router;
}
