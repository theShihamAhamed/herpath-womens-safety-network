import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/app-error.js';
import type { UserRole } from '../../modules/users/user.types.js';

export function authorize(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.auth) {
      next(
        new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
        }),
      );
      return;
    }

    if (!roles.includes(request.auth.role)) {
      next(
        new AppError({
          statusCode: 403,
          code: 'AUTHORIZATION_DENIED',
          message: 'You are not authorized to perform this action',
        }),
      );
      return;
    }

    next();
  };
}
