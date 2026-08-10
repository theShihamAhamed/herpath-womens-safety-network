import type { Response } from 'express';

import type { ApiErrorResponse, ApiSuccess } from '../types/api.js';

export function sendSuccess<
  T,
  M extends Record<string, unknown> = Record<string, unknown>,
>(
  response: Response,
  data: T,
  meta: M = {} as M,
  statusCode = 200,
): Response<ApiSuccess<T, M>> {
  return response.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

export function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string,
  details: unknown[] = [],
): Response<ApiErrorResponse> {
  const requestId = String(response.locals.requestId ?? 'unknown');

  return response.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    requestId,
  });
}
