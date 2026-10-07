// backend/src/modules/routes/recommendation.controller.ts
// HS-88 → HS-87 → HS-86: Full recommendation pipeline HTTP handler

import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import { getRouteAlternatives } from './routeAlternatives.service.js';
import { getRouteRecommendation } from './recommendation.service.js';
import { prepareRoutesForRiskEvaluation } from './routeRisk.service.js';
import type { RouteAlternativesRequest } from './routes.types.js';
import { parseAndValidateLatLng, validateRouteWithRiskContext } from './routes.validation.js';

export async function getRouteRecommendationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const origin = parseAndValidateLatLng(req.query.origin);
    const destination = parseAndValidateLatLng(req.query.destination);
    const mode = (req.query.mode as RouteAlternativesRequest['mode']) ?? 'walking';

    const routes = await getRouteAlternatives({ origin, destination, mode });
    const routesWithRiskContext = await prepareRoutesForRiskEvaluation(routes);
    const validatedRoutes = routesWithRiskContext.map(validateRouteWithRiskContext);
    const recommendation = await getRouteRecommendation(validatedRoutes);
    sendSuccess(res, recommendation);
  } catch (err) {
    next(err);
  }
}

