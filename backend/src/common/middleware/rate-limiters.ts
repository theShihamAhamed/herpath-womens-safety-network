import rateLimit from 'express-rate-limit';

import { sendError } from '../utils/api-response.js';

export interface GeneralRateLimiterOptions {
  windowMs: number;
  max: number;
}

export function createGeneralRateLimiter(options: GeneralRateLimiterOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
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
