import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { ModerationService } from './moderation.service.js';
import type {
  IncidentFlagParams,
  SubmitIncidentFlagInput,
} from './moderation.validation.js';

function authenticatedActorId(request: Request): string {
  if (!request.auth) throw new Error('Authentication context is missing');
  return request.auth.userId;
}

export class ModerationController {
  public constructor(private readonly moderation: ModerationService) {}

  public submitFlag = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { incidentId } = request.params as unknown as IncidentFlagParams;
      const result = await this.moderation.submitFlag(
        authenticatedActorId(request),
        incidentId,
        request.body as SubmitIncidentFlagInput,
      );
      sendSuccess(response, { flag: result.flag }, {}, result.created ? 201 : 200);
    } catch (error) {
      next(error);
    }
  };
}
