import { Router } from 'express';

import { validate } from '../../common/middleware/validate.js';
import { MapController } from './map.controller.js';
import { MapService } from './map.service.js';
import { GeoapifyTileService } from './geoapify-tile.service.js';
import { OverpassSupportPlaceProvider } from './overpass-support-place.provider.js';
import type { SupportPlaceProvider } from './support-place.provider.js';
import { SupportPlaceService } from './support-place.service.js';
import { areaSummaryQuerySchema, supportPlaceQuerySchema, tileParamsSchema, viewportQuerySchema } from './map.validation.js';

export function createMapRouter(options: {
  overpassApiUrl?: string;
  supportPlaceProvider?: SupportPlaceProvider;
  geoapifyApiKey?: string | undefined;
  tileRequest?: typeof fetch;
} = {}): Router {
  const router = Router();
  const service = new MapService();
  const supportPlaceService = new SupportPlaceService(
    options.supportPlaceProvider ?? new OverpassSupportPlaceProvider(options.overpassApiUrl),
  );
  const tileService = new GeoapifyTileService(options.geoapifyApiKey, options.tileRequest);
  const controller = new MapController(service, supportPlaceService, tileService);

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

  router.get('/tiles/:z/:x/:y', validate({ params: tileParamsSchema }), controller.getTile);

  return router;
}
