import { Router } from 'express';

import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import { ModerationController } from './moderation.controller.js';
import type { ModerationService } from './moderation.service.js';
import {
  incidentFlagParamsSchema,
  submitIncidentFlagBodySchema,
} from './moderation.validation.js';

export function createModerationRouter(auth: AuthService, moderation: ModerationService): Router {
  const router = Router();
  const controller = new ModerationController(moderation);
  const requireAuthentication = authenticate((token) => auth.authenticateAccessToken(token));

  router.post(
    '/:incidentId/flags',
    requireAuthentication,
    validate({ params: incidentFlagParamsSchema, body: submitIncidentFlagBodySchema }),
    controller.submitFlag,
  );

  return router;
}
