import { Router } from 'express';

import { authenticate } from '../../common/middleware/authenticate.js';
import { createAuthRateLimiter } from '../../common/middleware/rate-limiters.js';
import { validate } from '../../common/middleware/validate.js';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import {
  anonymousBodySchema,
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  registerBodySchema,
} from './auth.validation.js';

export function createAuthRouter(
  auth: AuthService,
  limiterOptions: { windowMs: number; max: number },
): Router {
  const router = Router();
  const controller = new AuthController(auth);
  const rateLimiter = createAuthRateLimiter(limiterOptions);
  const requireAuthentication = authenticate((token) => auth.authenticateAccessToken(token));

  router.post('/anonymous', rateLimiter, validate({ body: anonymousBodySchema }), controller.anonymous);
  router.post('/register', rateLimiter, validate({ body: registerBodySchema }), controller.register);
  router.post('/login', rateLimiter, validate({ body: loginBodySchema }), controller.login);
  router.post('/refresh', rateLimiter, validate({ body: refreshBodySchema }), controller.refresh);
  router.post('/logout', validate({ body: logoutBodySchema }), controller.logout);
  router.get('/me', requireAuthentication, controller.me);

  return router;
}
