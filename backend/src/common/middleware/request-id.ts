import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

export function requestId(request: Request, response: Response, next: NextFunction): void {
  const id = randomUUID();

  (request as Request & { id: string }).id = id;
  response.locals.requestId = id;
  response.setHeader(REQUEST_ID_HEADER, id);

  next();
}
