import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { IncidentService } from './incident.service.js';
import type {
  CreateIncidentInput,
  LocationCellsQuery,
  MineQuery,
} from './incident.validation.js';

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new Error('Authentication context is missing');
  return request.auth.userId;
}

export class IncidentController {
  public constructor(private readonly incidents: IncidentService) {}

  public create = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await this.incidents.create(
        authenticatedUserId(request),
        request.body as CreateIncidentInput,
      );
      sendSuccess(response, result.incident, {}, result.created ? 201 : 200);
    } catch (error) {
      next(error);
    }
  };

  public locationCells = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const items = this.incidents.listLocationCells(
        request.query as unknown as LocationCellsQuery,
      );
      sendSuccess(response, { items });
    } catch (error) {
      next(error);
    }
  };

  public mine = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(
        response,
        await this.incidents.mine(
          authenticatedUserId(request),
          request.query as unknown as MineQuery,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}
