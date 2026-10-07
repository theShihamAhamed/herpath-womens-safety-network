import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import * as journeyService from './journey.service.js';
import type {
  JourneyCoordinateBody,
  JourneyIdBody,
  JourneyIdParams,
  JourneyOutcomeBody,
  StartJourneyBody,
} from './journey.validation.js';

const wrap =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };

export const startJourney = wrap(async (request, response) => {
  const journey = await journeyService.startJourney(
    request.auth!.userId,
    request.body as StartJourneyBody,
  );
  sendSuccess(response, journey, {}, 201);
});

export const cancelJourney = wrap(async (request, response) => {
  const { journeyId } = request.body as JourneyIdBody;
  sendSuccess(response, await journeyService.cancelJourney(journeyId, request.auth!.userId));
});

export const updateLocation = wrap(async (request, response) => {
  const { journeyId, latitude, longitude } = request.body as JourneyCoordinateBody;
  sendSuccess(
    response,
    await journeyService.updateLocation(journeyId, request.auth!.userId, { latitude, longitude }),
  );
});

export const checkIn = wrap(async (request, response) => {
  const { journeyId, latitude, longitude } = request.body as JourneyCoordinateBody;
  sendSuccess(
    response,
    await journeyService.addCheckIn(journeyId, request.auth!.userId, { latitude, longitude }),
  );
});

export const reportDeviation = wrap(async (request, response) => {
  const { journeyId, latitude, longitude } = request.body as JourneyCoordinateBody;
  sendSuccess(
    response,
    await journeyService.recordDeviation(
      journeyId,
      request.auth!.userId,
      { latitude, longitude },
    ),
  );
});

export const finishJourney = wrap(async (request, response) => {
  const { journeyId } = request.body as JourneyIdBody;
  sendSuccess(response, await journeyService.finishJourney(journeyId, request.auth!.userId));
});

export const setOutcome = wrap(async (request, response) => {
  const { journeyId, outcome } = request.body as JourneyOutcomeBody;
  sendSuccess(
    response,
    await journeyService.setOutcome(journeyId, request.auth!.userId, outcome),
  );
});

export const getHistory = wrap(async (request, response) => {
  sendSuccess(response, await journeyService.getHistory(request.auth!.userId));
});

export const getJourneyById = wrap(async (request, response) => {
  const { id } = request.params as JourneyIdParams;
  sendSuccess(response, await journeyService.getJourneyById(id, request.auth!.userId));
});

export const getAnalyticsSummary = wrap(async (request, response) => {
  sendSuccess(response, await journeyService.getAnalyticsSummary(request.auth!.userId));
});
