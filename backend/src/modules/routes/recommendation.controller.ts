// backend/src/modules/routes/recommendation.controller.ts

import type { Request, Response } from 'express';
import { getRouteAlternatives } from './routeAlternatives.service.js';
import { prepareRoutesForRiskEvaluation } from './routeRisk.service.js';
import { getRouteRecommendation } from './recommendation.service.js';
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

/**
 * GET /api/routes/recommendation?origin=lat,lng&destination=lat,lng&mode=walking
 *
 * Full pipeline: HS-119 -> HS-120 -> HS-121 -> HS-122 -> HS-88 -> HS-87 -> HS-86
 */
export async function getRouteRecommendationHandler(req: Request, res: Response) {
  const origin = parseLatLng(req.query.origin);
  const destination = parseLatLng(req.query.destination);
  const mode = (req.query.mode as RouteAlternativesRequest['mode']) ?? 'walking';

  if (!origin || !destination) {
    return res.status(400).json({
      success: false,
      error: 'origin and destination are required as "lat,lng" query params.',
    });
  }

  try {
    const routes = await getRouteAlternatives({ origin, destination, mode });
    const routesWithRiskContext = await prepareRoutesForRiskEvaluation(routes);
    const recommendation = await getRouteRecommendation(routesWithRiskContext);

    return res.status(200).json({
      success: true,
      data: recommendation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate a recommendation.';
    return res.status(502).json({ success: false, error: message });
  }
}
