import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { ModerationWorkflowService } from './moderation-workflow.service.js';
import type {
  ClaimModerationCaseInput,
  DecideModerationCaseInput,
  ModerationCaseParams,
  ModerationCaseQueueQuery,
  ReleaseModerationCaseInput,
  ReopenModerationCaseInput,
} from './moderation-workflow.validation.js';

function authenticatedModeratorId(request: Request): string {
  if (!request.auth) throw new Error('Authentication context is missing');
  return request.auth.userId;
}

function caseId(request: Request): string {
  return (request.params as unknown as ModerationCaseParams).caseId;
}

export class ModerationWorkflowController {
  public constructor(private readonly workflow: ModerationWorkflowService) {}

  public queue = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(
        response,
        await this.workflow.queue(
          authenticatedModeratorId(request),
          request.query as unknown as ModerationCaseQueueQuery,
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  public detail = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, {
        case: await this.workflow.detail(authenticatedModeratorId(request), caseId(request)),
      });
    } catch (error) {
      next(error);
    }
  };

  public audits = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, {
        items: await this.workflow.auditHistory(caseId(request)),
      });
    } catch (error) {
      next(error);
    }
  };

  public claim = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, {
        case: await this.workflow.claim(
          authenticatedModeratorId(request),
          caseId(request),
          request.body as ClaimModerationCaseInput,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  public release = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, {
        case: await this.workflow.release(
          authenticatedModeratorId(request),
          caseId(request),
          request.body as ReleaseModerationCaseInput,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  public reopen = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, {
        case: await this.workflow.reopen(
          authenticatedModeratorId(request),
          caseId(request),
          request.body as ReopenModerationCaseInput,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  public decide = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, {
        case: await this.workflow.decide(
          authenticatedModeratorId(request),
          caseId(request),
          request.body as DecideModerationCaseInput,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}
