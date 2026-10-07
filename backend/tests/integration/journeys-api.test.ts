import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';
import { SessionModel } from '../../src/modules/auth/session.model.js';
import { MAX_ACTIVE_JOURNEY_AGE_MS } from '../../src/modules/journeys/journey-lifecycle.js';
import { Journey } from '../../src/modules/journeys/journey.model.js';
import { UserModel } from '../../src/modules/users/user.model.js';

const config: AppRuntimeConfig = {
  nodeEnv: 'test',
  corsOrigins: ['http://localhost:8081'],
  logLevel: 'silent',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 10_000,
  authRateLimitMax: 10_000,
  reportRateLimitWindowMs: 900_000,
  reportRateLimitMax: 10_000,
  trustProxy: false,
  accessTokenSecret: 'test-only-access-token-secret-at-least-32-chars',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  jwtIssuer: 'herpath-test-api',
  jwtAudience: 'herpath-test-client',
};

const silentLogger = pino({ level: 'silent' });

describe('authenticated journey APIs', () => {
  let mongo: MongoMemoryServer | undefined;
  let app: ReturnType<typeof createApp>;
  let token: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
    await mongoose.connect(mongo.getUri());
    await Journey.syncIndexes();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      Journey.deleteMany({}),
      SessionModel.deleteMany({}),
      UserModel.deleteMany({}),
    ]);
    app = createApp({ config, logger: silentLogger });
    const session = await request(app).post('/api/v1/auth/anonymous').send({}).expect(201);
    token = session.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('requires authentication on every journey read and write endpoint', async () => {
    await request(app).post('/api/v1/journeys/start').send(startBody()).expect(401);
    await request(app).get('/api/v1/journeys/history').expect(401);
    await request(app).get('/api/v1/analytics/summary').expect(401);
  });

  it('strictly validates identifiers, coordinates, outcomes, and unknown fields', async () => {
    const invalidStart = await authenticated('post', '/api/v1/journeys/start')
      .send({ ...startBody(), unexpected: true })
      .expect(400);
    expectErrorEnvelope(invalidStart.body, 'VALIDATION_ERROR');

    const invalidCoordinate = await authenticated('put', '/api/v1/journeys/location')
      .send({ journeyId: 'not-an-object-id', latitude: 91, longitude: 0 })
      .expect(400);
    expectErrorEnvelope(invalidCoordinate.body, 'VALIDATION_ERROR');

    const invalidOutcome = await authenticated('post', '/api/v1/journeys/outcome')
      .send({ journeyId: '0123456789abcdef01234567', outcome: 'SAFE' })
      .expect(400);
    expectErrorEnvelope(invalidOutcome.body, 'VALIDATION_ERROR');

    const invalidParams = await authenticated('get', '/api/v1/journeys/not-an-object-id')
      .expect(400);
    expectErrorEnvelope(invalidParams.body, 'VALIDATION_ERROR');
  });

  it('enforces one active journey under concurrent starts', async () => {
    const [first, second] = await Promise.all([
      authenticated('post', '/api/v1/journeys/start').send(startBody()),
      authenticated('post', '/api/v1/journeys/start').send(startBody()),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const conflict = first.status === 409 ? first : second;
    expectErrorEnvelope(conflict.body, 'ACTIVE_JOURNEY_EXISTS');
    expect(await Journey.countDocuments({ status: 'ACTIVE' })).toBe(1);
  });

  it('purges raw coordinates at finish and exposes only retained terminal facts', async () => {
    const started = await startJourney();
    const journeyId = started.body.data._id as string;

    await authenticated('put', '/api/v1/journeys/location')
      .send({ journeyId, latitude: 6.91, longitude: 79.81 })
      .expect(200);
    await authenticated('put', '/api/v1/journeys/checkin')
      .send({ journeyId, latitude: 6.92, longitude: 79.82 })
      .expect(200);
    await authenticated('put', '/api/v1/journeys/deviation')
      .send({ journeyId, latitude: 6.93, longitude: 79.83 })
      .expect(200);

    const finished = await authenticated('put', '/api/v1/journeys/finish')
      .send({ journeyId })
      .expect(200);
    expect(finished.body.meta).toEqual({});
    expect(finished.body.data).toMatchObject({
      status: 'COMPLETED',
      outcome: 'UNKNOWN',
      currentPath: [],
      checkIns: [],
      checkInCount: 1,
      deviationDetected: true,
      deviationLocation: null,
    });

    const detail = await authenticated('get', `/api/v1/journeys/${journeyId}`).expect(200);
    expect(detail.body.data.currentPath).toEqual([]);
    expect(detail.body.data.checkIns).toEqual([]);
    expect(detail.body.data.selectedRoute.polyline).toBe(startBody().polyline);

    const history = await authenticated('get', '/api/v1/journeys/history').expect(200);
    expect(history.body.data[0]).toMatchObject({
      checkInCount: 1,
      deviationDetected: true,
      outcome: 'UNKNOWN',
    });
    expect(history.body.data[0]).not.toHaveProperty('currentPath');
    expect(history.body.data[0]).not.toHaveProperty('checkIns');
    expect(history.body.data[0]).not.toHaveProperty('deviationLocation');
  });

  it('keeps finish and matching outcomes idempotent while locking confirmed outcomes', async () => {
    const journeyId = (await startJourney()).body.data._id as string;
    const firstFinish = await authenticated('put', '/api/v1/journeys/finish')
      .send({ journeyId })
      .expect(200);
    const secondFinish = await authenticated('put', '/api/v1/journeys/finish')
      .send({ journeyId })
      .expect(200);
    expect(secondFinish.body.data.endTime).toBe(firstFinish.body.data.endTime);

    await authenticated('post', '/api/v1/journeys/outcome')
      .send({ journeyId, outcome: 'SAFE_CONFIRMED' })
      .expect(200);
    await authenticated('post', '/api/v1/journeys/outcome')
      .send({ journeyId, outcome: 'SAFE_CONFIRMED' })
      .expect(200);
    const locked = await authenticated('post', '/api/v1/journeys/outcome')
      .send({ journeyId, outcome: 'INCIDENT_REPORTED' })
      .expect(409);
    expectErrorEnvelope(locked.body, 'OUTCOME_LOCKED');
  });

  it('cancels to UNKNOWN, purges coordinates, and rejects repeated cancellation clearly', async () => {
    const journeyId = (await startJourney()).body.data._id as string;
    await authenticated('put', '/api/v1/journeys/checkin')
      .send({ journeyId, latitude: 6.92, longitude: 79.82 })
      .expect(200);

    const cancelled = await authenticated('put', '/api/v1/journeys/cancel')
      .send({ journeyId })
      .expect(200);
    expect(cancelled.body.data).toMatchObject({
      status: 'COMPLETED',
      outcome: 'UNKNOWN',
      checkIns: [],
      checkInCount: 1,
    });

    const repeated = await authenticated('put', '/api/v1/journeys/cancel')
      .send({ journeyId })
      .expect(409);
    expectErrorEnvelope(repeated.body, 'JOURNEY_NOT_ACTIVE');
  });

  it('allows UNKNOWN to resolve to an incident and never permits a downgrade', async () => {
    const journeyId = (await startJourney()).body.data._id as string;
    await authenticated('put', '/api/v1/journeys/finish').send({ journeyId }).expect(200);
    await authenticated('post', '/api/v1/journeys/outcome')
      .send({ journeyId, outcome: 'INCIDENT_REPORTED' })
      .expect(200);
    const downgrade = await authenticated('post', '/api/v1/journeys/outcome')
      .send({ journeyId, outcome: 'SAFE_CONFIRMED' })
      .expect(409);
    expectErrorEnvelope(downgrade.body, 'OUTCOME_LOCKED');
  });

  it('lazily expires journeys after 24 hours in reads and analytics', async () => {
    const journeyId = (await startJourney()).body.data._id as string;
    const staleStart = new Date(Date.now() - MAX_ACTIVE_JOURNEY_AGE_MS - 60_000);
    await Journey.updateOne({ _id: journeyId }, { $set: { startTime: staleStart } });

    const history = await authenticated('get', '/api/v1/journeys/history').expect(200);
    expect(history.body.data[0]).toMatchObject({ status: 'COMPLETED', outcome: 'UNKNOWN' });
    const summary = await authenticated('get', '/api/v1/analytics/summary').expect(200);
    expect(summary.body.data).toMatchObject({
      activeJourneys: 0,
      completedJourneys: 1,
      unknownJourneys: 1,
      unknownPercentage: 100,
    });
  });

  it('returns a structured 404 for a valid but absent journey ID', async () => {
    const response = await authenticated('get', '/api/v1/journeys/0123456789abcdef01234567')
      .expect(404);
    expectErrorEnvelope(response.body, 'JOURNEY_NOT_FOUND');
  });

  it('does not expose a journey to a different authenticated owner', async () => {
    const journeyId = (await startJourney()).body.data._id as string;
    const otherSession = await request(app).post('/api/v1/auth/anonymous').send({}).expect(201);
    const response = await request(app)
      .get(`/api/v1/journeys/${journeyId}`)
      .set('Authorization', `Bearer ${otherSession.body.data.accessToken}`)
      .expect(404);
    expectErrorEnvelope(response.body, 'JOURNEY_NOT_FOUND');
  });

  it('keeps ACTIVE journeys out of completed analytics', async () => {
    await startJourney();
    const summary = await authenticated('get', '/api/v1/analytics/summary').expect(200);
    expect(summary.body.data).toMatchObject({
      activeJourneys: 1,
      completedJourneys: 0,
      safeJourneys: 0,
      incidentJourneys: 0,
      unknownJourneys: 0,
      safePercentage: 0,
      incidentPercentage: 0,
      unknownPercentage: 0,
    });
  });

  function authenticated(method: 'get' | 'post' | 'put', path: string) {
    return request(app)[method](path).set('Authorization', `Bearer ${token}`);
  }

  function startJourney() {
    return authenticated('post', '/api/v1/journeys/start').send(startBody()).expect(201);
  }
});

function startBody() {
  return {
    routeId: 'route-1',
    origin: { latitude: 6.9, longitude: 79.8, address: 'Origin' },
    destination: { latitude: 7, longitude: 79.9, address: 'Destination' },
    polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    distance: 1_000,
    duration: 600,
    riskScore: 0.25,
  };
}

function expectErrorEnvelope(body: unknown, code: string): void {
  expect(body).toMatchObject({
    success: false,
    error: { code, message: expect.any(String), details: expect.any(Array) },
    requestId: expect.any(String),
  });
}
