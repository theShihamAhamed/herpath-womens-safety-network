import { describe, expect, it } from 'vitest';

import { EnvironmentValidationError, loadEnvironment } from '../../src/config/env.js';

const baseEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017/herpath-test',
  ACCESS_TOKEN_SECRET: 'test-only-access-token-secret-at-least-32-chars',
};

describe('authentication environment validation', () => {
  it('requires an access-token secret in every environment', () => {
    expect(() => loadEnvironment({ ...baseEnvironment, ACCESS_TOKEN_SECRET: undefined })).toThrow(
      EnvironmentValidationError,
    );
  });

  it('rejects a signing secret shorter than 64 characters in production', () => {
    expect(() => loadEnvironment({ ...baseEnvironment, NODE_ENV: 'production' })).toThrow(
      /at least 64 characters in production/,
    );
  });

  it('loads secure authentication defaults and a stricter auth rate limit', () => {
    const environment = loadEnvironment(baseEnvironment);
    expect(environment).toMatchObject({
      accessTokenTtl: '15m',
      refreshTokenTtlDays: 30,
      jwtIssuer: 'herpath-api',
      jwtAudience: 'herpath-mobile',
      authRateLimitMax: 10,
      reportRateLimitWindowMs: 900_000,
      reportRateLimitMax: 5,
      feedbackRateLimitWindowMs: 900_000,
      feedbackRateLimitMax: 10,
      rateLimitMax: 200,
    });
  });
});
