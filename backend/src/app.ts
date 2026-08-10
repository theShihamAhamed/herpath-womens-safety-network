import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

import type { DatabaseStatus } from './config/database.js';
import { getDatabaseStatus } from './config/database.js';
import type { LogLevel, NodeEnvironment } from './config/env.js';
import { createLogger } from './config/logger.js';
import { AppError } from './common/errors/app-error.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { notFound } from './common/middleware/not-found.js';
import { createGeneralRateLimiter } from './common/middleware/rate-limiters.js';
import { requestId } from './common/middleware/request-id.js';
import { sendSuccess } from './common/utils/api-response.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService, type AuthService } from './modules/auth/auth.service.js';

export const API_PREFIX = '/api/v1';

export interface AppRuntimeConfig {
  nodeEnv: NodeEnvironment;
  corsOrigins: string[];
  logLevel: LogLevel;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitMax: number;
  trustProxy: boolean;
  accessTokenSecret: string;
  accessTokenTtl: string;
  refreshTokenTtlDays: number;
  jwtIssuer: string;
  jwtAudience: string;
}

export interface AppDependencies {
  config: AppRuntimeConfig;
  databaseStatus?: () => DatabaseStatus;
  logger?: Logger;
  authService?: AuthService;
}

const JSON_BODY_LIMIT = '100kb';

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  const databaseStatus = dependencies.databaseStatus ?? getDatabaseStatus;
  const logger =
    dependencies.logger ??
    createLogger(dependencies.config.nodeEnv, dependencies.config.logLevel);

  app.disable('x-powered-by');
  app.set('trust proxy', dependencies.config.trustProxy);

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || dependencies.config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new AppError({
            statusCode: 403,
            code: 'CORS_ORIGIN_DENIED',
            message: 'Origin is not allowed',
          }),
        );
      },
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(
    pinoHttp({
      logger,
      genReqId(request) {
        return (request as typeof request & { id?: string }).id ?? 'unknown';
      },
      serializers: {
        req(request) {
          return {
            id: request.id,
            method: request.method,
            url: request.url,
            remoteAddress: request.remoteAddress,
          };
        },
      },
    }),
  );
  app.use(
    createGeneralRateLimiter({
      windowMs: dependencies.config.rateLimitWindowMs,
      max: dependencies.config.rateLimitMax,
    }),
  );

  const authService =
    dependencies.authService ??
    createAuthService({
      accessTokenSecret: dependencies.config.accessTokenSecret,
      accessTokenTtl: dependencies.config.accessTokenTtl,
      refreshTokenTtlDays: dependencies.config.refreshTokenTtlDays,
      jwtIssuer: dependencies.config.jwtIssuer,
      jwtAudience: dependencies.config.jwtAudience,
    });

  app.use(
    `${API_PREFIX}/auth`,
    createAuthRouter(authService, {
      windowMs: dependencies.config.rateLimitWindowMs,
      max: dependencies.config.authRateLimitMax,
    }),
  );

  app.get(`${API_PREFIX}/health`, (_request, response, next) => {
    if (databaseStatus() !== 'connected') {
      next(
        new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database is unavailable',
        }),
      );
      return;
    }

    sendSuccess(response, {
      status: 'ok',
      database: 'connected',
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
