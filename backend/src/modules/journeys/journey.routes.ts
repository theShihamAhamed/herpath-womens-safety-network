import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import * as journeyController from './journey.controller.js';
import {
  emptyQuerySchema,
  journeyCoordinateBodySchema,
  journeyIdBodySchema,
  journeyIdParamsSchema,
  journeyOutcomeBodySchema,
  startJourneyBodySchema,
} from './journey.validation.js';

export function createJourneyRouter(auth: AuthService): Router {
  const router = Router();
  const requireAuthentication = authenticate((token) => auth.authenticateAccessToken(token));

  router.post(
    '/journeys/start',
    requireAuthentication,
    validate({ body: startJourneyBodySchema }),
    journeyController.startJourney,
  );
  router.put(
    '/journeys/cancel',
    requireAuthentication,
    validate({ body: journeyIdBodySchema }),
    journeyController.cancelJourney,
  );
  router.put(
    '/journeys/location',
    requireAuthentication,
    validate({ body: journeyCoordinateBodySchema }),
    journeyController.updateLocation,
  );
  router.put(
    '/journeys/checkin',
    requireAuthentication,
    validate({ body: journeyCoordinateBodySchema }),
    journeyController.checkIn,
  );
  router.put(
    '/journeys/deviation',
    requireAuthentication,
    validate({ body: journeyCoordinateBodySchema }),
    journeyController.reportDeviation,
  );
  router.put(
    '/journeys/finish',
    requireAuthentication,
    validate({ body: journeyIdBodySchema }),
    journeyController.finishJourney,
  );
  router.post(
    '/journeys/outcome',
    requireAuthentication,
    validate({ body: journeyOutcomeBodySchema }),
    journeyController.setOutcome,
  );
  router.get(
    '/journeys/history',
    requireAuthentication,
    validate({ query: emptyQuerySchema }),
    journeyController.getHistory,
  );
  router.get(
    '/journeys/:id',
    requireAuthentication,
    validate({ params: journeyIdParamsSchema, query: emptyQuerySchema }),
    journeyController.getJourneyById,
  );
  router.get(
    '/analytics/summary',
    requireAuthentication,
    validate({ query: emptyQuerySchema }),
    journeyController.getAnalyticsSummary,
  );

  return router;
}
