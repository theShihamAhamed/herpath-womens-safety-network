import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import express from 'express';
import { decodeJwt } from 'jose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';
import { authenticate } from '../../src/common/middleware/authenticate.js';
import { authorize } from '../../src/common/middleware/authorize.js';
import { errorHandler } from '../../src/common/middleware/error-handler.js';
import { requestId } from '../../src/common/middleware/request-id.js';
import { sendSuccess } from '../../src/common/utils/api-response.js';
import { createAuthService, type AuthService } from '../../src/modules/auth/auth.service.js';
import { SessionModel } from '../../src/modules/auth/session.model.js';
import { UserModel } from '../../src/modules/users/user.model.js';

const config: AppRuntimeConfig = {
  nodeEnv: 'test',
  corsOrigins: ['http://localhost:8081'],
  logLevel: 'silent',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 10_000,
  authRateLimitMax: 10_000,
  trustProxy: false,
  accessTokenSecret: 'test-only-access-token-secret-at-least-32-chars',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  jwtIssuer: 'herpath-test-api',
  jwtAudience: 'herpath-test-client',
};

const silentLogger = pino({ level: 'silent' });
const registeredUser = {
  name: '  Ayesha   Perera  ',
  email: '  AYESHA@Example.COM ',
  password: 'Correct Horse Battery 42!',
};

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function assertNoSecrets(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/passwordHash|refreshTokenHash/);
}

function findLocalMongoBinary(): string | undefined {
  if (process.platform !== 'win32') return undefined;
  const serverDirectory = 'C:\\Program Files\\MongoDB\\Server';
  if (!existsSync(serverDirectory)) return undefined;

  const versions = readdirSync(serverDirectory).sort().reverse();
  for (const version of versions) {
    const candidate = path.join(serverDirectory, version, 'bin', 'mongod.exe');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

describe('authentication and session foundation', () => {
  let mongo: MongoMemoryServer | undefined;
  let auth: AuthService;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const systemBinary = findLocalMongoBinary();
    mongo = await MongoMemoryServer.create(
      systemBinary ? { binary: { systemBinary } } : undefined,
    );
    await mongoose.connect(mongo.getUri());
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({})]);
    auth = createAuthService(config);
    app = createApp({ config, logger: silentLogger, authService: auth });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('creates an anonymous user when the request has no body', async () => {
    const response = await request(app)
      .post('/api/v1/auth/anonymous')
      .set('Content-Length', '0')
      .expect(201);

    expect(response.body.data.user).toMatchObject({
      accountType: 'ANONYMOUS',
      role: 'USER',
      status: 'ACTIVE',
    });
    expect(response.body.data.user).not.toHaveProperty('name');
    expect(response.body.data.user).not.toHaveProperty('email');
    expect(response.body.data).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(await UserModel.findOne({ accountType: 'ANONYMOUS' }).lean()).not.toHaveProperty('email');
    assertNoSecrets(response.body);
  });

  it('rejects privilege-related fields in an anonymous-session body', async () => {
    const response = await request(app)
      .post('/api/v1/auth/anonymous')
      .send({ role: 'MODERATOR', status: 'ACTIVE' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await UserModel.countDocuments()).toBe(0);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('registers a normalized user with an Argon2id hash and no secret projection', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(registeredUser)
      .expect(201);

    expect(response.body.data.user).toMatchObject({
      accountType: 'REGISTERED',
      name: 'Ayesha Perera',
      email: 'ayesha@example.com',
      role: 'USER',
      status: 'ACTIVE',
    });
    const stored = await UserModel.findOne({ email: 'ayesha@example.com' })
      .select('+passwordHash')
      .lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain(registeredUser.password);
    assertNoSecrets(response.body);
  });

  it('rejects a 3-character registered password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registeredUser, password: 'abc' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('accepts a 4-character registered password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registeredUser, password: 'abcd' })
      .expect(201);

    expect(response.body.data.user.email).toBe('ayesha@example.com');
    const stored = await UserModel.findOne({ email: 'ayesha@example.com' })
      .select('+passwordHash')
      .lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects duplicate registered emails after normalization', async () => {
    await request(app).post('/api/v1/auth/register').send(registeredUser).expect(201);
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registeredUser, email: 'ayesha@example.com' })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects public role and status injection during registration', async () => {
    for (const injected of [{ role: 'MODERATOR' }, { status: 'DISABLED' }]) {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...registeredUser, ...injected })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('logs in a registered active user with valid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(registeredUser).expect(201);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'AYESHA@example.com', password: registeredUser.password })
      .expect(200);

    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe('ayesha@example.com');
  });

  it('uses a generic login failure for an unknown email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.com', password: registeredUser.password })
      .expect(401);

    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect',
    });
  });

  it('uses the same generic login failure for a wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send(registeredUser).expect(201);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registeredUser.email, password: 'Definitely Wrong Password!' })
      .expect(401);

    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect',
    });
  });

  it('issues access tokens containing only the required short-lived claims', async () => {
    const response = await request(app).post('/api/v1/auth/anonymous').send({}).expect(201);
    const payload = decodeJwt(response.body.data.accessToken as string);

    expect(Object.keys(payload).sort()).toEqual(
      ['aud', 'exp', 'iat', 'iss', 'role', 'sid', 'sub'].sort(),
    );
    expect(payload).toMatchObject({
      aud: config.jwtAudience,
      iss: config.jwtIssuer,
      role: 'USER',
      sub: response.body.data.user.id,
    });
    expect(Number(payload.exp) - Number(payload.iat)).toBe(900);
  });

  it('returns the authenticated user from /auth/me with a safe projection', async () => {
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send(registeredUser)
      .expect(201);
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registration.body.data.accessToken}`)
      .expect(200);

    expect(response.body.data.user).toEqual(registration.body.data.user);
    assertNoSecrets(response.body);
  });

  it('rotates refresh tokens and persists only SHA-256 token hashes', async () => {
    const initial = await request(app).post('/api/v1/auth/anonymous').send({}).expect(201);
    const oldToken = initial.body.data.refreshToken as string;
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldToken })
      .expect(200);
    const newToken = response.body.data.refreshToken as string;

    expect(newToken).not.toBe(oldToken);
    const sessions = await SessionModel.find().select('+refreshTokenHash').lean();
    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.refreshTokenHash)).toEqual(
      expect.arrayContaining([tokenHash(oldToken), tokenHash(newToken)]),
    );
    expect(JSON.stringify(sessions)).not.toContain(oldToken);
    expect(JSON.stringify(sessions)).not.toContain(newToken);
    expect(sessions.find((session) => session.refreshTokenHash === tokenHash(oldToken))).toMatchObject({
      revokeReason: 'ROTATED',
    });
  });

  it('detects rotated refresh-token reuse and revokes the replacement session', async () => {
    const initial = await request(app).post('/api/v1/auth/anonymous').send({}).expect(201);
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initial.body.data.refreshToken })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initial.body.data.refreshToken })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.data.refreshToken })
      .expect(401);

    expect(await SessionModel.countDocuments({ revokedAt: null })).toBe(0);
  });

  it('logs out idempotently and prevents later refresh', async () => {
    const initial = await request(app).post('/api/v1/auth/anonymous').send({}).expect(201);
    const body = { refreshToken: initial.body.data.refreshToken };

    await request(app).post('/api/v1/auth/logout').send(body).expect(200);
    await request(app).post('/api/v1/auth/logout').send(body).expect(200);
    const response = await request(app).post('/api/v1/auth/refresh').send(body).expect(401);
    expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects an invalid access token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('rejects an expired access token', async () => {
    const expiredConfig = { ...config, accessTokenTtl: '0s' };
    const expiredAuth = createAuthService(expiredConfig);
    const expiredApp = createApp({
      config: expiredConfig,
      logger: silentLogger,
      authService: expiredAuth,
    });
    const session = await request(expiredApp).post('/api/v1/auth/anonymous').send({}).expect(201);

    await request(expiredApp)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.body.data.accessToken}`)
      .expect(401);
  });

  it('denies a USER from a MODERATOR-only route', async () => {
    const session = await request(app).post('/api/v1/auth/anonymous').send({}).expect(201);
    const protectedApp = createModeratorApp(auth);

    const response = await request(protectedApp)
      .get('/moderator')
      .set('Authorization', `Bearer ${session.body.data.accessToken}`)
      .expect(403);
    expect(response.body.error.code).toBe('AUTHORIZATION_DENIED');
  });

  it('allows a safely provisioned MODERATOR through a MODERATOR-only route', async () => {
    await request(app).post('/api/v1/auth/register').send(registeredUser).expect(201);
    await UserModel.updateOne({ email: 'ayesha@example.com' }, { $set: { role: 'MODERATOR' } });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registeredUser.email, password: registeredUser.password })
      .expect(200);

    await request(createModeratorApp(auth))
      .get('/moderator')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200);
  });

  it('fails safely for disabled users during login and existing access', async () => {
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send(registeredUser)
      .expect(201);
    await UserModel.updateOne({ email: 'ayesha@example.com' }, { $set: { status: 'DISABLED' } });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registeredUser.email, password: registeredUser.password })
      .expect(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registration.body.data.accessToken}`)
      .expect(401);
  });

  it('hides password and refresh-token hashes from default database projections', async () => {
    await request(app).post('/api/v1/auth/register').send(registeredUser).expect(201);
    const [user, session] = await Promise.all([
      UserModel.findOne({ email: 'ayesha@example.com' }).lean(),
      SessionModel.findOne().lean(),
    ]);

    expect(user).not.toHaveProperty('passwordHash');
    expect(session).not.toHaveProperty('refreshTokenHash');
  });
});

function createModeratorApp(auth: AuthService) {
  const protectedApp = express();
  protectedApp.use(requestId);
  protectedApp.get(
    '/moderator',
    authenticate((token) => auth.authenticateAccessToken(token)),
    authorize('MODERATOR'),
    (_request, response) => sendSuccess(response, { authorized: true }),
  );
  protectedApp.use(errorHandler);
  return protectedApp;
}
