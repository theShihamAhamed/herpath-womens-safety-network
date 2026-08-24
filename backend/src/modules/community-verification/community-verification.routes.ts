import { Router } from 'express';

import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import { CommunityVerificationController } from './community-verification.controller.js';
import type { CommunityVerificationService } from './community-verification.service.js';
import {
  incidentFeedbackParamsSchema,
  submitFeedbackBodySchema,
} from './community-verification.validation.js';

export function createCommunityVerificationRouter(
  auth: AuthService,
  verification: CommunityVerificationService,
): Router {
  const router = Router();
  const controller = new CommunityVerificationController(verification);
  const requireAuthentication = authenticate((token) => auth.authenticateAccessToken(token));

  router.post(
    '/:incidentId/feedback',
    requireAuthentication,
    validate({ params: incidentFeedbackParamsSchema, body: submitFeedbackBodySchema }),
    controller.submit,
  );
  router.delete(
    '/:incidentId/feedback',
    requireAuthentication,
    validate({ params: incidentFeedbackParamsSchema }),
    controller.remove,
  );
  router.get(
    '/:incidentId/verification',
    requireAuthentication,
    validate({ params: incidentFeedbackParamsSchema }),
    controller.status,
  );
  router.get(
    '/:incidentId/feedback/eligibility',
    requireAuthentication,
    validate({ params: incidentFeedbackParamsSchema }),
    controller.eligibility,
  );

  return router;
}
