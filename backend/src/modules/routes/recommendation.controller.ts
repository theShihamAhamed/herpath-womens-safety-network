// backend/src/modules/routes/recommendation.controller.ts
// HS-88 → HS-87 → HS-86: Full recommendation pipeline HTTP handler

import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../common/errors/app-error.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { getRouteAlternatives } from './routeAlternatives.service.js';
import { getRouteRecommendation } from './recommendation.service.js';
import { prepareRoutesForRiskEvaluation } from './routeRisk.service.js';
import type { RouteAlternativesRequest } from './routes.types.js';

function parseLatLng(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split(',');
  const latStr = parts[0];
  const lngStr = parts[1];
  if (!latStr || !lngStr) return null;
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}


export async function getRouteRecommendationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const origin = parseLatLng(req.query.origin);
  const destination = parseLatLng(req.query.destination);
  const mode = (req.query.mode as RouteAlternativesRequest['mode']) ?? 'walking';

  if (!origin || !destination) {
    next(
      new AppError({
        statusCode: 400,
        code: 'INVALID_COORDINATES',
        message: 'origin and destination are required as "lat,lng" query params.',
      }),
    );
    return;
  }

  try {
    const routes = await getRouteAlternatives({ origin, destination, mode });
    const routesWithRiskContext = await prepareRoutesForRiskEvaluation(routes);
    const recommendation = await getRouteRecommendation(routesWithRiskContext);
    sendSuccess(res, recommendation);
  } catch (err) {
    next(err);
  }
}
