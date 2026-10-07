import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';

const silentLogger = pino({ level: 'silent' });

function createTestApp(overrides: Partial<AppRuntimeConfig> = {}) {
  const config: AppRuntimeConfig = {
    nodeEnv: 'test',
    corsOrigins: ['http://localhost:8081'],
    logLevel: 'silent',
    rateLimitWindowMs: 60_000,
    rateLimitMax: 1_000,
    authRateLimitMax: 1_000,
    mapTileRateLimitWindowMs: 60_000,
    mapTileRateLimitMax: 1_000,
    reportRateLimitWindowMs: 900_000,
    reportRateLimitMax: 5,
    trustProxy: false,
    accessTokenSecret: 'test-only-access-token-secret-at-least-32-chars',
    accessTokenTtl: '15m',
    refreshTokenTtlDays: 30,
    jwtIssuer: 'herpath-test-api',
    jwtAudience: 'herpath-test-client',
    ...overrides,
  };

  return createApp({
    config,
    databaseStatus: () => 'connected',
    logger: silentLogger,
  });
}

describe('API rate-limit boundaries', () => {
  it('continues to apply the global limiter to ordinary API requests', async () => {
    const app = createTestApp({ rateLimitMax: 2 });

    await request(app).get('/api/v1/health').expect(200);
    await request(app).get('/api/v1/health').expect(200);
    const response = await request(app).get('/api/v1/health').expect(429);

    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('continues to apply the stricter limiter to authentication endpoints', async () => {
    const app = createTestApp({ authRateLimitMax: 2 });

    await request(app).post('/api/v1/auth/login').send({}).expect(400);
    await request(app).post('/api/v1/auth/login').send({}).expect(400);
    const response = await request(app).post('/api/v1/auth/login').send({}).expect(429);

    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('does not count map tile requests against the ordinary global limiter', async () => {
    const app = createTestApp({ rateLimitMax: 1, mapTileRateLimitMax: 10 });

    await request(app).get('/api/v1/map/tiles/1/2/0').expect(400);
    await request(app).get('/api/v1/map/tiles/1/2/0').expect(400);
    await request(app).get('/api/v1/health').expect(200);
  });

  it('applies the dedicated limiter to map tile requests', async () => {
    const app = createTestApp({ rateLimitMax: 1, mapTileRateLimitMax: 2 });

    await request(app).get('/api/v1/map/tiles/1/2/0').expect(400);
    await request(app).get('/api/v1/map/tiles/1/2/0').expect(400);
    const response = await request(app).get('/api/v1/map/tiles/1/2/0').expect(429);

    expect(response.body.error.code).toBe('MAP_TILE_RATE_LIMIT_EXCEEDED');
  });
});
