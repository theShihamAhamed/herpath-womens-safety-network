import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import type { AuthService } from '../auth/auth.service.js';
import * as journeyController from './journey.controller.js';

export function createJourneyRouter(auth: AuthService): Router {
  const router = Router();
  const requireAuthentication = authenticate((token) => auth.authenticateAccessToken(token));

  router.use(requireAuthentication);

  router.post('/journeys/start', journeyController.startJourney);
  router.put('/journeys/location', journeyController.updateLocation);
  router.put('/journeys/checkin', journeyController.checkIn);
  router.put('/journeys/deviation', journeyController.reportDeviation);
  router.put('/journeys/finish', journeyController.finishJourney);
  router.post('/journeys/outcome', journeyController.setOutcome);
  router.get('/journeys/history', journeyController.getHistory);
  router.get('/journeys/:id', journeyController.getJourneyById);
  router.get('/analytics/summary', journeyController.getAnalyticsSummary);

  return router;
}