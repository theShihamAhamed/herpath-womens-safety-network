import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';

import { AppError } from '../errors/app-error.js';
import { sendError } from '../utils/api-response.js';

interface HttpSyntaxError extends SyntaxError {
  status?: number;
  type?: string;
}

function zodDetails(error: z.ZodError): unknown[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof z.ZodError) {
    sendError(
      response,
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      zodDetails(error),
    );
    return;
  }

  const syntaxError = error as HttpSyntaxError;
  if (error instanceof SyntaxError && syntaxError.status === 400) {
    sendError(response, 400, 'INVALID_JSON', 'Request body contains invalid JSON');
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      request.log?.warn(
        { code: error.code, requestId: response.locals.requestId },
        'Operational request failure',
      );
    }

    sendError(response, error.statusCode, error.code, error.message, error.details);
    return;
  }

  request.log?.error(
    {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      requestId: response.locals.requestId,
    },
    'Unexpected request failure',
  );

  sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
};
