import { Router } from 'express';

import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import { ModerationWorkflowController } from './moderation-workflow.controller.js';
import type { ModerationWorkflowService } from './moderation-workflow.service.js';
import {
  claimModerationCaseBodySchema,
  decideModerationCaseBodySchema,
  moderationCaseParamsSchema,
  moderationCaseQueueQuerySchema,
  releaseModerationCaseBodySchema,
  reopenModerationCaseBodySchema,
} from './moderation-workflow.validation.js';

export function createModerationWorkflowRouter(
  auth: AuthService,
  workflow: ModerationWorkflowService,
): Router {
  const router = Router();
  const controller = new ModerationWorkflowController(workflow);

  router.use(
    authenticate((token) => auth.authenticateAccessToken(token)),
    authorize('MODERATOR'),
  );
  router.get('/cases', validate({ query: moderationCaseQueueQuerySchema }), controller.queue);
  router.get('/cases/:caseId', validate({ params: moderationCaseParamsSchema }), controller.detail);
  router.post(
    '/cases/:caseId/claim',
    validate({ params: moderationCaseParamsSchema, body: claimModerationCaseBodySchema }),
    controller.claim,
  );
  router.post(
    '/cases/:caseId/release',
    validate({ params: moderationCaseParamsSchema, body: releaseModerationCaseBodySchema }),
    controller.release,
  );
  router.post(
    '/cases/:caseId/reopen',
    validate({ params: moderationCaseParamsSchema, body: reopenModerationCaseBodySchema }),
    controller.reopen,
  );
  router.post(
    '/cases/:caseId/decision',
    validate({ params: moderationCaseParamsSchema, body: decideModerationCaseBodySchema }),
    controller.decide,
  );

  return router;
}
