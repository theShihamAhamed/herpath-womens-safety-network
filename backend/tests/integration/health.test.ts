import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';
import { AppError } from '../../src/common/errors/app-error.js';
import { errorHandler } from '../../src/common/middleware/error-handler.js';
import { requestId } from '../../src/common/middleware/request-id.js';
import { validate } from '../../src/common/middleware/validate.js';

const testConfig: AppRuntimeConfig = {
  nodeEnv: 'test',
  corsOrigins: ['http://localhost:8081'],
  logLevel: 'silent',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 1_000,
  authRateLimitMax: 1_000,
  reportRateLimitWindowMs: 900_000,
  reportRateLimitMax: 5,
  trustProxy: false,
  accessTokenSecret: 'test-only-access-token-secret-at-least-32-chars',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  jwtIssuer: 'herpath-test-api',
  jwtAudience: 'herpath-test-client',
};

const silentLogger = pino({ level: 'silent' });

describe('backend foundation', () => {
  it('returns the standard success envelope when the database is connected', async () => {
    const app = createApp({
      config: testConfig,
      databaseStatus: () => 'connected',
      logger: silentLogger,
    });

    const response = await request(app).get('/api/v1/health').expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        database: 'connected',
      },
      meta: {},
    });
  });

  it('returns a sanitized service error when the database is disconnected', async () => {
    const app = createApp({
      config: testConfig,
      databaseStatus: () => 'disconnected',
      logger: silentLogger,
    });

    const response = await request(app).get('/api/v1/health').expect(503);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
        details: [],
      },
      requestId: response.headers['x-request-id'],
    });
    expect(JSON.stringify(response.body)).not.toMatch(/mongodb|stack|filesystem/i);
  });

  it('returns the standard 404 error envelope', async () => {
    const app = createApp({
      config: testConfig,
      databaseStatus: () => 'connected',
      logger: silentLogger,
    });

    const response = await request(app).get('/api/v1/missing').expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: [],
      },
      requestId: response.headers['x-request-id'],
    });
  });

  it('formats operational failures through the shared error handler', async () => {
    const app = express();
    app.use(requestId);
    app.get('/failure', (_request, _response, next) => {
      next(
        new AppError({
          statusCode: 409,
          code: 'TEST_CONFLICT',
          message: 'The requested operation conflicts with current state',
          details: [{ field: 'state' }],
        }),
      );
    });
    app.use(errorHandler);

    const response = await request(app).get('/failure').expect(409);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'TEST_CONFLICT',
        message: 'The requested operation conflicts with current state',
        details: [{ field: 'state' }],
      },
      requestId: response.headers['x-request-id'],
    });
  });

  it('formats Zod request-validation failures without echoing input', async () => {
    const app = express();
    app.use(requestId);
    app.use(express.json());
    app.post(
      '/validated',
      validate({
        body: z.object({
          category: z.string().min(1),
        }),
      }),
      (_request, response) => response.status(204).send(),
    );
    app.use(errorHandler);

    const response = await request(app)
      .post('/validated')
      .send({ category: '', secret: 'must-not-be-echoed' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([
      {
        code: 'too_small',
        path: 'category',
        message: expect.any(String),
      },
    ]);
    expect(JSON.stringify(response.body)).not.toContain('must-not-be-echoed');
  });

  it('sanitizes unexpected errors without returning messages or stack traces', async () => {
    const app = express();
    app.use(requestId);
    app.get('/unexpected', () => {
      throw new Error('internal driver detail for secret-host database');
    });
    app.use(errorHandler);

    const response = await request(app).get('/unexpected').expect(500);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: [],
      },
      requestId: response.headers['x-request-id'],
    });
    expect(JSON.stringify(response.body)).not.toMatch(/secret-host|driver detail|stack/i);
  });
});
