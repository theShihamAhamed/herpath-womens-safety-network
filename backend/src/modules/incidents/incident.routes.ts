import { Router } from 'express';

import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import { IncidentController } from './incident.controller.js';
import type { IncidentService } from './incident.service.js';
import {
  createIncidentBodySchema,
  locationCellsQuerySchema,
  mineQuerySchema,
} from './incident.validation.js';

export function createIncidentRouter(auth: AuthService, incidents: IncidentService): Router {
  const router = Router();
  const controller = new IncidentController(incidents);
  const requireAuthentication = authenticate((token) => auth.authenticateAccessToken(token));

  router.post(
    '/',
    requireAuthentication,
    validate({ body: createIncidentBodySchema }),
    controller.create,
  );
  router.get(
    '/location-cells',
    requireAuthentication,
    validate({ query: locationCellsQuerySchema }),
    controller.locationCells,
  );
  router.get('/mine', requireAuthentication, validate({ query: mineQuerySchema }), controller.mine);

  return router;
}
