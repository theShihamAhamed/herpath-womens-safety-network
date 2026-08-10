import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';

export interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: RequestSchemas) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        request.params = schemas.params.parse(request.params) as Request['params'];
      }

      if (schemas.query) {
        request.query = schemas.query.parse(request.query) as Request['query'];
      }

      if (schemas.body) {
        request.body = schemas.body.parse(request.body) as unknown;
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(error);
        return;
      }

      next(error);
    }
  };
}
