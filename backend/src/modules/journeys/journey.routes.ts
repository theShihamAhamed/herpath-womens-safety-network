import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import type { AuthService } from '../auth/auth.service.js';
import * as journeyController from './journey.controller.js';

export function createJourneyRouter(auth: AuthService): Router {
  const router = Router();
  const requireAuthentication = authenticate((token) => auth.authenticateAccessToken(token));

  router.post('/journeys/start', requireAuthentication, journeyController.startJourney);
  router.put('/journeys/location', requireAuthentication, journeyController.updateLocation);
  router.put('/journeys/checkin', requireAuthentication, journeyController.checkIn);
  router.put('/journeys/deviation', requireAuthentication, journeyController.reportDeviation);
  router.put('/journeys/finish', requireAuthentication, journeyController.finishJourney);
  router.post('/journeys/outcome', requireAuthentication, journeyController.setOutcome);
  router.get('/journeys/history', requireAuthentication, journeyController.getHistory);
  router.get('/journeys/:id', requireAuthentication, journeyController.getJourneyById);
  router.get('/analytics/summary', requireAuthentication, journeyController.getAnalyticsSummary);

  return router;
}