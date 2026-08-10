import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/app-error.js';
import type { AuthenticationContext } from '../types/auth.js';

export type AccessTokenAuthenticator = (token: string) => Promise<AuthenticationContext>;

function authenticationError(): AppError {
  return new AppError({
    statusCode: 401,
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication is required',
  });
}

export function authenticate(authenticateAccessToken: AccessTokenAuthenticator) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const authorization = request.header('authorization');
      const match = authorization?.match(/^Bearer ([^\s]+)$/);

      if (!match?.[1]) {
        throw authenticationError();
      }

      request.auth = await authenticateAccessToken(match[1]);
      next();
    } catch {
      next(authenticationError());
    }
  };
}
