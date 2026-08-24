import { randomUUID } from 'node:crypto';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';
import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';
import type {
  CreateIncidentPersistenceInput,
  GeoJsonPoint,
  IncidentCategory,
  IncidentSeverity,
} from '../../src/modules/incidents/incident.types.js';
import { exactPointToPublicCell } from '../../src/modules/incidents/location-privacy.service.js';

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
const repository = new IncidentRepository();
const colombo: GeoJsonPoint = { type: 'Point', coordinates: [79.8612, 6.9271] };
const nearby: GeoJsonPoint = { type: 'Point', coordinates: [79.87, 6.935] };
const outside: GeoJsonPoint = { type: 'Point', coordinates: [80.2, 7.2] };

function incidentInput(options: {
  point?: GeoJsonPoint;
  approximate?: boolean;
  occurredAt?: Date;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  description?: string;
} = {}): CreateIncidentPersistenceInput {
  const point = options.point ?? colombo;
  return {
    reporterId: new Types.ObjectId().toString(),
    clientSubmissionId: randomUUID(),
    category: options.category ?? 'HARASSMENT',
    severity: options.severity ?? 'HIGH',
    occurredAt: options.occurredAt ?? new Date(Date.now() - 24 * 60 * 60_000),
    description: options.description ?? 'private description sentinel',
    location: options.approximate
      ? { mode: 'APPROXIMATE_ONLY', publicCellId: exactPointToPublicCell(point) }
      : { mode: 'EXACT_PRIVATE', privateLocation: point },
  };
}

function expectPublicIncidentContract(value: Record<string, unknown>): void {
  expect(Object.keys(value).sort()).toEqual(
    [
      'id',
      'category',
      'severity',
      'status',
      'occurredAt',
      'createdAt',
      'supportCount',
      'publicLocation',
      'publicArea',
    ].sort(),
  );
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    'reporterId',
    'clientSubmissionId',
    'privateLocation',
    'locationMode',
    'publicCellId',
    'description',
    'visibilityState',
    'communityState',
    'moderationState',
    'lifecycleRevision',
    '__v',
    'private description sentinel',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe('persisted incidents through public Map APIs', () => {
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
    await IncidentModel.deleteMany({});
    app = createApp({ config, logger: silentLogger });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('uses lifecycle visibility with a privacy-safe legacy compatibility fallback', async () => {
    const exact = await repository.create(incidentInput());
    const approximate = await repository.create(
      incidentInput({ point: nearby, approximate: true, category: 'THEFT', severity: 'LOW' }),
    );
    await IncidentModel.collection.updateOne(
      { _id: approximate._id },
      { $set: { communityState: 'SUPPORTED', lifecycleRevision: 1 } },
    );
    const hidden = await repository.create(incidentInput({ point: nearby }));
    await IncidentModel.collection.updateOne(
      { _id: hidden._id },
      { $set: { visibilityState: 'HIDDEN', status: 'REJECTED', lifecycleRevision: 1 } },
    );
    const archived = await repository.create(incidentInput({ point: nearby }));
    await IncidentModel.collection.updateOne(
      { _id: archived._id },
      { $set: { visibilityState: 'ARCHIVED', status: 'ARCHIVED', lifecycleRevision: 1 } },
    );
    const legacy = await repository.create(
      incidentInput({ point: nearby, approximate: true, category: 'OTHER' }),
    );
    await IncidentModel.collection.updateOne(
      { _id: legacy._id },
      {
        $unset: {
          visibilityState: '',
          communityState: '',
          moderationState: '',
          lifecycleRevision: '',
        },
      },
    );
    await repository.create(incidentInput({ point: outside }));
    await IncidentModel.updateOne({ _id: exact._id }, { $set: { supportCount: 3 } });

    const response = await request(app)
      .get('/api/v1/map/incidents')
      .query({ swLat: 6.8, swLng: 79.8, neLat: 7, neLng: 80 })
      .expect(200);

    expect(response.body).toMatchObject({ success: true, meta: {} });
    expect(response.body.data.map((incident: { id: string }) => incident.id).sort()).toEqual(
      [exact._id.toString(), approximate._id.toString(), legacy._id.toString()].sort(),
    );
    for (const incident of response.body.data as Array<Record<string, unknown>>) {
      expectPublicIncidentContract(incident);
      expect(incident.occurredAt).toEqual(expect.any(String));
      expect(incident.createdAt).toEqual(expect.any(String));
      const area = incident.publicArea as { type: string; coordinates: number[][][] };
      expect(area.type).toBe('Polygon');
      expect(area.coordinates[0]?.at(-1)).toEqual(area.coordinates[0]?.[0]);
    }
    expect(
      response.body.data.find(
        (incident: { id: string }) => incident.id === approximate._id.toString(),
      ).status,
    ).toBe('COMMUNITY_SUPPORTED');
    expect(
      response.body.data.find(
        (incident: { id: string }) => incident.id === legacy._id.toString(),
      ).status,
    ).toBe('PUBLISHED_UNVERIFIED');
    expect(response.body.data.map((incident: { id: string }) => incident.id)).not.toContain(
      hidden._id.toString(),
    );
    expect(response.body.data.map((incident: { id: string }) => incident.id)).not.toContain(
      archived._id.toString(),
    );
    expect(response.body.data.find((incident: { id: string }) => incident.id === exact._id.toString()).supportCount).toBe(3);
  });

  it('uses only the public H3 center for viewport inclusion', async () => {
    const exact = await repository.create(incidentInput());
    const [publicLongitude, publicLatitude] = exact.publicLocation.coordinates;
    const [privateLongitude, privateLatitude] = colombo.coordinates;
    const delta = Math.max(
      Math.abs(publicLongitude - privateLongitude),
      Math.abs(publicLatitude - privateLatitude),
    );
    const epsilon = delta / 4;
    expect(delta).toBeGreaterThan(0);

    const aroundPublicCenter = await request(app)
      .get('/api/v1/map/incidents')
      .query({
        swLat: publicLatitude - epsilon,
        swLng: publicLongitude - epsilon,
        neLat: publicLatitude + epsilon,
        neLng: publicLongitude + epsilon,
      })
      .expect(200);
    expect(aroundPublicCenter.body.data.map((incident: { id: string }) => incident.id)).toContain(
      exact._id.toString(),
    );

    const aroundPrivatePoint = await request(app)
      .get('/api/v1/map/incidents')
      .query({
        swLat: privateLatitude - epsilon,
        swLng: privateLongitude - epsilon,
        neLat: privateLatitude + epsilon,
        neLng: privateLongitude + epsilon,
      })
      .expect(200);
    expect(aroundPrivatePoint.body.data).toEqual([]);
  });

  it('filters inclusively by occurredAt rather than createdAt', async () => {
    const before = await repository.create(
      incidentInput({ occurredAt: new Date('2026-08-09T23:59:59Z') }),
    );
    const fromBoundary = await repository.create(
      incidentInput({ occurredAt: new Date('2026-08-10T00:00:00Z'), category: 'THEFT' }),
    );
    const toBoundary = await repository.create(
      incidentInput({ occurredAt: new Date('2026-08-18T00:00:00Z'), severity: 'LOW' }),
    );
    const after = await repository.create(
      incidentInput({ occurredAt: new Date('2026-08-18T00:00:01Z') }),
    );
    await IncidentModel.updateOne(
      { _id: before._id },
      { $set: { createdAt: new Date('2026-08-19T00:00:00Z') } },
      { timestamps: false },
    );
    await IncidentModel.updateOne(
      { _id: fromBoundary._id },
      { $set: { createdAt: new Date('2025-01-01T00:00:00Z') } },
      { timestamps: false },
    );

    const response = await request(app)
      .get('/api/v1/map/incidents')
      .query({
        swLat: 6.8,
        swLng: 79.8,
        neLat: 7,
        neLng: 80,
        occurredFrom: '2026-08-10T00:00:00Z',
        occurredTo: '2026-08-18T00:00:00Z',
      })
      .expect(200);
    const ids = response.body.data.map((incident: { id: string }) => incident.id);

    expect(ids.sort()).toEqual([fromBoundary._id.toString(), toBoundary._id.toString()].sort());
    expect(ids).not.toContain(before._id.toString());
    expect(ids).not.toContain(after._id.toString());

    const fromOnly = await request(app)
      .get('/api/v1/map/incidents')
      .query({
        swLat: 6.8,
        swLng: 79.8,
        neLat: 7,
        neLng: 80,
        occurredFrom: '2026-08-10T00:00:00Z',
      })
      .expect(200);
    expect(fromOnly.body.data.map((incident: { id: string }) => incident.id)).not.toContain(
      before._id.toString(),
    );

    const toOnly = await request(app)
      .get('/api/v1/map/incidents')
      .query({
        swLat: 6.8,
        swLng: 79.8,
        neLat: 7,
        neLng: 80,
        occurredTo: '2026-08-18T00:00:00Z',
      })
      .expect(200);
    expect(toOnly.body.data.map((incident: { id: string }) => incident.id)).not.toContain(
      after._id.toString(),
    );

    const categoryFiltered = await request(app)
      .get('/api/v1/map/incidents')
      .query({ swLat: 6.8, swLng: 79.8, neLat: 7, neLng: 80, category: 'THEFT' })
      .expect(200);
    expect(categoryFiltered.body.data.map((incident: { id: string }) => incident.id)).toEqual([
      fromBoundary._id.toString(),
    ]);
  });

  it('strictly rejects invalid, wrapped, stale, and malformed Map query parameters', async () => {
    const base = { swLat: 6.8, swLng: 79.8, neLat: 7, neLng: 80 };
    const invalidViewportQueries = [
      { ...base, swLat: 7.1 },
      { ...base, swLng: 170, neLng: -170 },
      { ...base, neLat: 91 },
      { ...base, occurredFrom: '2026-08-01' },
      {
        ...base,
        occurredFrom: '2026-08-18T00:00:00Z',
        occurredTo: '2026-08-01T00:00:00Z',
      },
      { ...base, dateFrom: '2026-08-01' },
      { ...base, startHour: 18 },
    ];

    for (const query of invalidViewportQueries) {
      const response = await request(app).get('/api/v1/map/incidents').query(query).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    await request(app)
      .get('/api/v1/map/area-summary')
      .query({ lat: 6.927, lng: 79.861, occurredFrom: 'not-a-timestamp' })
      .expect(400);
  });

  it('aggregates only public nearby incidents and respects occurrence filters', async () => {
    const recent = await repository.create(
      incidentInput({
        occurredAt: new Date(Date.now() - 24 * 60 * 60_000),
        category: 'HARASSMENT',
        severity: 'HIGH',
      }),
    );
    await repository.create(
      incidentInput({
        point: nearby,
        approximate: true,
        occurredAt: new Date(Date.now() - 40 * 24 * 60 * 60_000),
        category: 'THEFT',
        severity: 'LOW',
      }),
    );
    await repository.create(incidentInput({ point: outside, category: 'ASSAULT' }));
    const hidden = await repository.create(incidentInput({ point: nearby, category: 'STALKING' }));
    await IncidentModel.collection.updateOne(
      { _id: hidden._id },
      { $set: { visibilityState: 'HIDDEN', status: 'REJECTED', lifecycleRevision: 1 } },
    );

    const summary = await request(app)
      .get('/api/v1/map/area-summary')
      .query({ lat: 6.9271, lng: 79.8612, radius: 3000 })
      .expect(200);
    expect(summary.body.data).toMatchObject({
      center: { latitude: 6.9271, longitude: 79.8612 },
      radiusMeters: 3000,
      totalIncidents: 2,
      byCategory: { HARASSMENT: 1, THEFT: 1, ASSAULT: 0, STALKING: 0, OTHER: 0 },
      bySeverity: { LOW: 1, MEDIUM: 0, HIGH: 1, CRITICAL: 0 },
      recentCount: 1,
      dataDisclaimer: 'Based on available community data',
    });
    expect(JSON.stringify(summary.body)).not.toMatch(
      /reporterId|clientSubmissionId|privateLocation|locationMode|publicCellId|description/,
    );

    const filtered = await request(app)
      .get('/api/v1/map/area-summary')
      .query({
        lat: 6.9271,
        lng: 79.8612,
        radius: 3000,
        occurredFrom: new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString(),
      })
      .expect(200);
    expect(filtered.body.data.totalIncidents).toBe(1);
    expect(filtered.body.data.byCategory.HARASSMENT).toBe(1);
    expect(filtered.body.data.recentCount).toBe(1);
    expect(recent._id).toBeDefined();
  });

  it('preserves the area-summary zero state', async () => {
    const response = await request(app)
      .get('/api/v1/map/area-summary')
      .query({ lat: -20, lng: -120, radius: 1000 })
      .expect(200);

    expect(response.body.data).toMatchObject({
      totalIncidents: 0,
      recentCount: 0,
      byCategory: { HARASSMENT: 0, THEFT: 0, ASSAULT: 0, STALKING: 0, OTHER: 0 },
      bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    });
  });
});
