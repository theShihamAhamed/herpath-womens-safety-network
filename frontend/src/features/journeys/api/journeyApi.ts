// TODO(verify): confirm this import path matches the real client location
// (e.g. frontend/src/services/api/client.ts) and confirm ApiRequestOptions'
// exact field names (method / accessToken / body) match what's used below.
import { apiRequest } from '../../../services/api/client';
import { apiEndpoints } from '../../../services/api/endpoints';

import type {
  Coordinate,
  IncomingRouteParams,
  Journey,
  JourneyHistoryItem,
  JourneyOutcome,
  AnalyticsSummary,
} from '../types';

export const journeyApi = {
  start: (accessToken: string, params: IncomingRouteParams) =>
    apiRequest<Journey>(apiEndpoints.journeys.start, {
      method: 'POST',
      accessToken,
      body: params,
    }),

  updateLocation: (accessToken: string, journeyId: string, point: Coordinate) =>
    apiRequest<Journey>(apiEndpoints.journeys.location, {
      method: 'PUT',
      accessToken,
      body: { journeyId, ...point },
    }),

  checkIn: (accessToken: string, journeyId: string, point: Coordinate) =>
    apiRequest<Journey>(apiEndpoints.journeys.checkin, {
      method: 'PUT',
      accessToken,
      body: { journeyId, ...point },
    }),

  reportDeviation: (accessToken: string, journeyId: string, point: Coordinate) =>
    apiRequest<Journey>(apiEndpoints.journeys.deviation, {
      method: 'PUT',
      accessToken,
      body: { journeyId, ...point },
    }),

  finish: (accessToken: string, journeyId: string) =>
    apiRequest<Journey>(apiEndpoints.journeys.finish, {
      method: 'PUT',
      accessToken,
      body: { journeyId },
    }),

  setOutcome: (accessToken: string, journeyId: string, outcome: JourneyOutcome) =>
    apiRequest<Journey>(apiEndpoints.journeys.outcome, {
      method: 'POST',
      accessToken,
      body: { journeyId, outcome },
    }),

  history: (accessToken: string) =>
    apiRequest<JourneyHistoryItem[]>(apiEndpoints.journeys.history, {
      method: 'GET',
      accessToken,
    }),

  getById: (accessToken: string, id: string) =>
    apiRequest<Journey>(apiEndpoints.journeys.byId(id), {
      method: 'GET',
      accessToken,
    }),

  analyticsSummary: (accessToken: string) =>
    apiRequest<AnalyticsSummary>(apiEndpoints.analytics.summary, {
      method: 'GET',
      accessToken,
    }),
};