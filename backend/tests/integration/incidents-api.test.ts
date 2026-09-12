import { randomUUID } from 'node:crypto';

import { getResolution, latLngToCell } from 'h3-js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';
import { SessionModel } from '../../src/modules/auth/session.model.js';
import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';
import type { CreateIncidentPersistenceInput } from '../../src/modules/incidents/incident.types.js';
import {
  exactPointToPublicCell,
  publicPointFromCell,
} from '../../src/modules/incidents/location-privacy.service.js';
import { UserModel } from '../../src/modules/users/user.model.js';

const config: AppRuntimeConfig = {
  nodeEnv: 'test',
  corsOrigins: ['http://localhost:8081'],
  logLevel: 'silent',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 10_000,
  authRateLimitMax: 10_000,
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
const exactPoint = { type: 'Point' as const, coordinates: [79.8612, 6.9271] as [number, number] };
const approximateCell = exactPointToPublicCell(exactPoint);
const repository = new IncidentRepository();

interface Actor {
  id: string;
  token: string;
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    clientSubmissionId: randomUUID(),
    category: 'HARASSMENT',
    severity: 'HIGH',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    description: 'Non-identifying details',
    location: {
      mode: 'EXACT_PRIVATE',
      privateLocation: exactPoint,
    },
    ...overrides,
  };
}

function authorization(actor: Actor): Record<string, string> {
  return { Authorization: `Bearer ${actor.token}` };
}

function expectNoProtectedFields(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const field of [
    'reporterId',
    'clientSubmissionId',
    'privateLocation',
    'publicCellId',
    'publicLocation',
    'publicArea',
    'coordinates',
    'visibilityState',
    'communityState',
    'moderationState',
    'lifecycleRevision',
  ]) {
    expect(serialized).not.toContain(field);
  }
}

describe('authenticated incident reporting APIs', () => {
  let mongo: MongoMemoryServer | undefined;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      binary: { version: '7.0.14' },
    });
    await mongoose.connect(mongo.getUri());
    await IncidentModel.syncIndexes();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      IncidentModel.deleteMany({}),
      SessionModel.deleteMany({}),
      UserModel.deleteMany({}),
    ]);
    app = createApp({ config, logger: silentLogger });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  async function anonymousActor(): Promise<Actor> {
    const response = await request(app).post('/api/v1/auth/anonymous').send({}).expect(201);
    return { id: response.body.data.user.id, token: response.body.data.accessToken };
  }

  async function registeredActor(): Promise<Actor> {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Incident Reporter',
        email: `${randomUUID()}@example.com`,
        password: 'Correct Horse Battery 42!',
      })
      .expect(201);
    return { id: response.body.data.user.id, token: response.body.data.accessToken };
  }

  it('allows anonymous and registered actors to create owner-safe reports', async () => {
    for (const actor of [await anonymousActor(), await registeredActor()]) {
      const response = await request(app)
        .post('/api/v1/incidents')
        .set(authorization(actor))
        .send(createBody())
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          category: 'HARASSMENT',
          severity: 'HIGH',
          status: 'PUBLISHED_UNVERIFIED',
          supportCount: 0,
          locationMode: 'EXACT_PRIVATE',
        },
        meta: {},
      });
      expect(Object.keys(response.body.data).sort()).toEqual(
        [
          'id',
          'category',
          'severity',
          'status',
          'occurredAt',
          'createdAt',
          'supportCount',
          'locationMode',
          'description',
        ].sort(),
      );
      expectNoProtectedFields(response.body.data);
    }
  });

  it('derives owner status without changing or exposing the owner response contract', async () => {
    const actor = await anonymousActor();
    const created = await repository.create(persistenceInput(actor.id, 0));
    await IncidentModel.collection.updateOne(
      { _id: created._id },
      { $set: { communityState: 'SUPPORTED', lifecycleRevision: 1 } },
    );

    const response = await request(app)
      .get('/api/v1/incidents/mine')
      .set(authorization(actor))
      .expect(200);
    const [item] = response.body.data.items;

    expect(item.status).toBe('COMMUNITY_SUPPORTED');
    expect(item.supportCount).toBe(0);
    expect(Object.keys(item).sort()).toEqual(
      [
        'id',
        'category',
        'severity',
        'status',
        'occurredAt',
        'createdAt',
        'supportCount',
        'locationMode',
        'description',
      ].sort(),
    );
    expectNoProtectedFields(item);
  });

  it('requires authentication and rejects ownership or unknown-field injection', async () => {
    await request(app).post('/api/v1/incidents').send(createBody()).expect(401);
    const actor = await anonymousActor();

    for (const body of [
      createBody({ reporterId: new mongoose.Types.ObjectId().toString() }),
      createBody({ status: 'MODERATOR_REVIEWED' }),
      createBody({ visibilityState: 'HIDDEN' }),
      createBody({ communityState: 'SUPPORTED' }),
      createBody({ moderationState: 'RESOLVED' }),
      createBody({ lifecycleRevision: 1 }),
      createBody({ unexpected: true }),
      createBody({ location: { ...createBody().location, unexpected: true } }),
    ]) {
      const response = await request(app)
        .post('/api/v1/incidents')
        .set(authorization(actor))
        .send(body)
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await IncidentModel.countDocuments()).toBe(0);
  });

  it('stores exact coordinates privately and derives resolution-8 public data', async () => {
    const actor = await anonymousActor();
    const response = await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(createBody())
      .expect(201);
    const stored = await IncidentModel.findById(response.body.data.id)
      .select('+reporterId +clientSubmissionId +privateLocation +publicCellId')
      .exec();

    expect(stored?.reporterId.toString()).toBe(actor.id);
    expect(stored?.privateLocation).toEqual(expect.objectContaining(exactPoint));
    expect(stored?.publicCellId).toBe(approximateCell);
    expect(stored?.publicLocation).toEqual(expect.objectContaining(publicPointFromCell(approximateCell)));
    expect(getResolution(stored?.publicCellId ?? '')).toBe(8);
    expect(stored?.toObject()).not.toHaveProperty('publicArea');
  });

  it('strictly validates exact-private GeoJSON and location-mode exclusivity', async () => {
    const actor = await anonymousActor();
    const invalidLocations = [
      { mode: 'EXACT_PRIVATE', privateLocation: { type: 'LineString', coordinates: exactPoint.coordinates } },
      { mode: 'EXACT_PRIVATE', privateLocation: { type: 'Point', coordinates: [181, 6.9271] } },
      { mode: 'EXACT_PRIVATE', privateLocation: { type: 'Point', coordinates: [79.8612, 91] } },
      { mode: 'EXACT_PRIVATE', privateLocation: exactPoint, selectedAreaCellId: approximateCell },
    ];

    for (const location of invalidLocations) {
      const response = await request(app)
        .post('/api/v1/incidents')
        .set(authorization(actor))
        .send(createBody({ location }))
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(response.body)).not.toContain('79.8612');
    }
  });

  it('accepts only a resolution-8 cell for approximate-only reports and stores no private point', async () => {
    const actor = await anonymousActor();
    const response = await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(createBody({
        location: { mode: 'APPROXIMATE_ONLY', selectedAreaCellId: approximateCell },
      }))
      .expect(201);
    const stored = await IncidentModel.findById(response.body.data.id)
      .select('+privateLocation +publicCellId')
      .exec();

    expect(response.body.data.locationMode).toBe('APPROXIMATE_ONLY');
    expect(stored?.privateLocation).toBeNull();
    expect(stored?.publicCellId).toBe(approximateCell);
    expectNoProtectedFields(response.body.data);
  });

  it('rejects precise, invalid, or wrong-resolution approximate-only location input', async () => {
    const actor = await anonymousActor();
    for (const location of [
      { mode: 'APPROXIMATE_ONLY', selectedAreaCellId: 'not-an-h3-cell' },
      { mode: 'APPROXIMATE_ONLY', selectedAreaCellId: latLngToCell(6.9271, 79.8612, 7) },
      { mode: 'APPROXIMATE_ONLY', selectedAreaCellId: approximateCell, privateLocation: exactPoint },
      { mode: 'APPROXIMATE_ONLY', selectedAreaCellId: approximateCell, coordinates: exactPoint.coordinates },
    ]) {
      await request(app)
        .post('/api/v1/incidents')
        .set(authorization(actor))
        .send(createBody({ location }))
        .expect(400);
    }
    expect(await IncidentModel.countDocuments()).toBe(0);
  });

  it('accepts Z and positive or negative offsets but rejects timezone-less and future times', async () => {
    const actor = await anonymousActor();
    for (const occurredAt of [
      '2026-08-18T14:45:00Z',
      '2026-08-18T20:15:00+05:30',
      '2026-08-18T09:45:00-05:00',
    ]) {
      await request(app)
        .post('/api/v1/incidents')
        .set(authorization(actor))
        .send(createBody({ occurredAt }))
        .expect(201);
    }

    await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(createBody({ occurredAt: '2026-08-18T20:15:00' }))
      .expect(400);
    await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(createBody({ occurredAt: new Date(Date.now() + 6 * 60_000).toISOString() }))
      .expect(400);
  });

  it('normalizes descriptions and enforces the 500-character maximum', async () => {
    const actor = await anonymousActor();
    const descriptions: Array<[string | undefined, string | undefined]> = [
      [undefined, undefined],
      ['  trimmed details  ', 'trimmed details'],
      ['   ', undefined],
      ['x'.repeat(500), 'x'.repeat(500)],
    ];

    for (const [description, expected] of descriptions) {
      const body = createBody();
      if (description === undefined) delete body.description;
      else body.description = description;
      const response = await request(app)
        .post('/api/v1/incidents')
        .set(authorization(actor))
        .send(body)
        .expect(201);
      if (expected === undefined) expect(response.body.data).not.toHaveProperty('description');
      else expect(response.body.data.description).toBe(expected);
    }

    await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(createBody({ description: 'x'.repeat(501) }))
      .expect(400);
  });

  it('returns 200 for an identical replay and 409 for changed normalized intent', async () => {
    const actor = await anonymousActor();
    const body = createBody({ description: '  stable text  ' });
    const first = await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(body)
      .expect(201);
    const replay = await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send({ ...body, description: 'stable text' })
      .expect(200);
    const conflict = await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send({ ...body, category: 'THEFT' })
      .expect(409);

    expect(replay.body.data).toEqual(first.body.data);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await IncidentModel.countDocuments()).toBe(1);
  });

  it('scopes idempotency by reporter and recovers concurrent duplicate inserts', async () => {
    const firstActor = await anonymousActor();
    const secondActor = await anonymousActor();
    const sharedBody = createBody();
    await request(app)
      .post('/api/v1/incidents')
      .set(authorization(firstActor))
      .send(sharedBody)
      .expect(201);
    await request(app)
      .post('/api/v1/incidents')
      .set(authorization(secondActor))
      .send(sharedBody)
      .expect(201);

    const concurrentBody = createBody();
    const concurrent = await Promise.all([
      request(app).post('/api/v1/incidents').set(authorization(firstActor)).send(concurrentBody),
      request(app).post('/api/v1/incidents').set(authorization(firstActor)).send(concurrentBody),
    ]);
    expect(concurrent.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(await IncidentModel.countDocuments({ clientSubmissionId: concurrentBody.clientSubmissionId })).toBe(1);
    expect(await IncidentModel.countDocuments({ clientSubmissionId: sharedBody.clientSubmissionId })).toBe(2);
  });

  it('allows five new reports per actor while replays consume no additional slot', async () => {
    const actor = await anonymousActor();
    const acceptedBodies = Array.from({ length: 5 }, () => createBody());
    for (const body of acceptedBodies) {
      await request(app)
        .post('/api/v1/incidents')
        .set(authorization(actor))
        .send(body)
        .expect(201);
    }

    await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(acceptedBodies[0])
      .expect(200);
    const limited = await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(createBody())
      .expect(429);
    expect(limited.body.error.code).toBe('REPORT_RATE_LIMIT_EXCEEDED');

    const otherActor = await anonymousActor();
    await request(app)
      .post('/api/v1/incidents')
      .set(authorization(otherActor))
      .send(createBody())
      .expect(201);
  });

  it('does not double-count a concurrent idempotent submission against quota', async () => {
    const actor = await anonymousActor();
    const duplicate = createBody();
    const attempts = await Promise.all([
      request(app).post('/api/v1/incidents').set(authorization(actor)).send(duplicate),
      request(app).post('/api/v1/incidents').set(authorization(actor)).send(duplicate),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([200, 201]);

    for (let index = 0; index < 4; index += 1) {
      await request(app)
        .post('/api/v1/incidents')
        .set(authorization(actor))
        .send(createBody())
        .expect(201);
    }
    await request(app)
      .post('/api/v1/incidents')
      .set(authorization(actor))
      .send(createBody())
      .expect(429);
  });

  it('returns bounded, privacy-safe resolution-8 selectable cells without persistence', async () => {
    const actor = await anonymousActor();
    const response = await request(app)
      .get('/api/v1/incidents/location-cells')
      .set(authorization(actor))
      .query({ north: 6.95, south: 6.9, east: 79.9, west: 79.85 })
      .expect(200);

    expect(response.body).toMatchObject({ success: true, data: { items: expect.any(Array) }, meta: {} });
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.items.length).toBeLessThanOrEqual(200);
    for (const cell of response.body.data.items) {
      expect(Object.keys(cell).sort()).toEqual(['cellId', 'publicArea', 'publicLocation'].sort());
      expect(getResolution(cell.cellId)).toBe(8);
      expect(cell.publicArea.type).toBe('Polygon');
      expect(cell.publicArea.coordinates[0].at(-1)).toEqual(cell.publicArea.coordinates[0][0]);
    }
    expect(await IncidentModel.countDocuments()).toBe(0);
  });

  it('rejects invalid or unbounded location-cell viewports with controlled envelopes', async () => {
    const actor = await anonymousActor();
    const invalidQueries = [
      { north: 7.1, south: 6.9, east: 79.9, west: 79.85 },
      { north: 6.95, south: 6.9, east: 80.1, west: 79.85 },
      { north: 6.95, south: 6.9, east: 79.8, west: 79.9 },
      { north: 91, south: 6.9, east: 79.9, west: 79.85 },
    ];
    for (const query of invalidQueries) {
      const response = await request(app)
        .get('/api/v1/incidents/location-cells')
        .set(authorization(actor))
        .query(query)
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const oversized = await request(app)
      .get('/api/v1/incidents/location-cells')
      .set(authorization(actor))
      .query({ north: -9.9, south: -10, east: -119.9, west: -120 })
      .expect(422);
    expect(oversized.body.error).toMatchObject({
      code: 'LOCATION_VIEWPORT_TOO_LARGE',
      message: 'Zoom in to choose an approximate reporting area.',
    });
    expect(JSON.stringify(oversized.body)).not.toContain('cellCount');
  });

  it('returns only the current owner reports with deterministic opaque cursor pagination', async () => {
    const actor = await anonymousActor();
    const otherActor = await anonymousActor();
    const createdIds: string[] = [];
    for (let index = 0; index < 25; index += 1) {
      const incident = await repository.create(persistenceInput(actor.id, index));
      createdIds.push(incident._id.toString());
    }
    await repository.create(persistenceInput(otherActor.id, 100));

    const defaultPage = await request(app)
      .get('/api/v1/incidents/mine')
      .set(authorization(actor))
      .expect(200);
    expect(defaultPage.body.data.items).toHaveLength(20);
    expect(defaultPage.body.data.nextCursor).toEqual(expect.any(String));

    const collected: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await request(app)
        .get('/api/v1/incidents/mine')
        .set(authorization(actor))
        .query({ limit: 7, ...(cursor ? { cursor } : {}) })
        .expect(200);
      for (const item of response.body.data.items) {
        collected.push(item.id);
        expectNoProtectedFields(item);
      }
      cursor = response.body.data.nextCursor;
    } while (cursor);

    expect(collected).toHaveLength(25);
    expect(new Set(collected).size).toBe(25);
    expect(collected).toEqual([...createdIds].reverse());
  });

  it('validates owner-history limits, cursors, authentication, and query ownership', async () => {
    const actor = await anonymousActor();
    await request(app).get('/api/v1/incidents/mine').expect(401);
    for (const query of [
      { limit: 0 },
      { limit: 51 },
      { cursor: 'not-an-opaque-cursor' },
      { reporterId: new mongoose.Types.ObjectId().toString() },
    ]) {
      const response = await request(app)
        .get('/api/v1/incidents/mine')
        .set(authorization(actor))
        .query(query)
        .expect(400);
      expect(['VALIDATION_ERROR', 'INVALID_CURSOR']).toContain(response.body.error.code);
    }
  });
});

function persistenceInput(reporterId: string, index: number): CreateIncidentPersistenceInput {
  return {
    reporterId,
    clientSubmissionId: randomUUID(),
    category: index % 2 === 0 ? 'HARASSMENT' : 'THEFT',
    severity: 'MEDIUM',
    occurredAt: new Date(Date.now() - index * 60_000),
    description: `Report ${index}`,
    location: { mode: 'APPROXIMATE_ONLY', publicCellId: approximateCell },
  };
}
