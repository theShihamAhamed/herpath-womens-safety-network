import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

import { sendError } from '../utils/api-response.js';

export interface GeneralRateLimiterOptions {
  windowMs: number;
  max: number;
  skip?: (request: Request) => boolean;
}

export const createAuthRateLimiter = createGeneralRateLimiter;

export function createGeneralRateLimiter(options: GeneralRateLimiterOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    ...(options.skip === undefined ? {} : { skip: options.skip }),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) =>
      sendError(
        response,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Please try again later.',
      ),
  });
}

export function createMapTileRateLimiter(options: GeneralRateLimiterOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) =>
      sendError(
        response,
        429,
        'MAP_TILE_RATE_LIMIT_EXCEEDED',
        'Too many map tile requests. Please try again later.',
      ),
  });
}
