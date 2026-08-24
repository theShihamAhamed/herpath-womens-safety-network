import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { CommunityVerificationService } from './community-verification.service.js';
import type {
  IncidentFeedbackParams,
  SubmitFeedbackInput,
} from './community-verification.validation.js';

function authenticatedActorId(request: Request): string {
  if (!request.auth) throw new Error('Authentication context is missing');
  return request.auth.userId;
}

export class CommunityVerificationController {
  public constructor(private readonly verification: CommunityVerificationService) {}

  public submit = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { incidentId } = request.params as unknown as IncidentFeedbackParams;
      const result = await this.verification.submit(
        authenticatedActorId(request),
        incidentId,
        request.body as SubmitFeedbackInput,
      );
      sendSuccess(response, { feedback: result.myFeedback, evidence: result.evidence }, {}, result.created ? 201 : 200);
    } catch (error) {
      next(error);
    }
  };

  public remove = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { incidentId } = request.params as unknown as IncidentFeedbackParams;
      sendSuccess(response, await this.verification.remove(authenticatedActorId(request), incidentId));
    } catch (error) {
      next(error);
    }
  };

  public status = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { incidentId } = request.params as unknown as IncidentFeedbackParams;
      sendSuccess(response, await this.verification.status(authenticatedActorId(request), incidentId));
    } catch (error) {
      next(error);
    }
  };

  public eligibility = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { incidentId } = request.params as unknown as IncidentFeedbackParams;
      sendSuccess(
        response,
        await this.verification.eligibility(authenticatedActorId(request), incidentId),
      );
    } catch (error) {
      next(error);
    }
  };
}
