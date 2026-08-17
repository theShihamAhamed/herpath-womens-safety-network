import { Router } from 'express';

import { validate } from '../../common/middleware/validate.js';
import { MapController } from './map.controller.js';
import { MapService } from './map.service.js';
import { areaSummaryQuerySchema, viewportQuerySchema } from './map.validation.js';

export function createMapRouter(): Router {
  const router = Router();
  const service = new MapService();
  const controller = new MapController(service);

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

  return router;
}
