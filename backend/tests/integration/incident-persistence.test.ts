import { randomUUID } from 'node:crypto';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { toPublicIncident } from '../../src/modules/incidents/incident.public.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';
import type {
  CreateIncidentPersistenceInput,
  GeoJsonPoint,
} from '../../src/modules/incidents/incident.types.js';
import {
  exactPointToPublicCell,
  normalizeIncidentLocation,
} from '../../src/modules/incidents/location-privacy.service.js';

const exactLocation: GeoJsonPoint = {
  type: 'Point',
  coordinates: [79.8612, 6.9271],
};

function incidentInput(
  overrides: Partial<CreateIncidentPersistenceInput> = {},
): CreateIncidentPersistenceInput {
  return {
    reporterId: new Types.ObjectId().toString(),
    clientSubmissionId: randomUUID(),
    category: 'HARASSMENT',
    severity: 'HIGH',
    occurredAt: new Date('2026-08-18T14:45:00.000Z'),
    description: 'A non-identifying description',
    location: { mode: 'EXACT_PRIVATE', privateLocation: exactLocation },
    ...overrides,
  };
}

describe('incident persistence foundation', () => {
  let mongo: MongoMemoryServer | undefined;
  const repository = new IncidentRepository();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      binary: { version: '7.0.14' },
    });
    await mongoose.connect(mongo.getUri());
    await IncidentModel.syncIndexes();
  }, 120_000);

  beforeEach(async () => {
    await IncidentModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('persists exact-private and approximate-only incidents with privacy-safe locations', async () => {
    const exact = await repository.create(incidentInput());
    const cellId = exactPointToPublicCell(exactLocation);
    const approximate = await repository.create(
      incidentInput({
        location: { mode: 'APPROXIMATE_ONLY', publicCellId: cellId },
      }),
    );

    expect(exact.privateLocation).toEqual(expect.objectContaining(exactLocation));
    expect(exact.publicCellId).toBe(cellId);
    expect(approximate.locationMode).toBe('APPROXIMATE_ONLY');
    expect(approximate.privateLocation).toBeNull();
    expect(approximate.publicCellId).toBe(cellId);
  });

  it('prevents incompatible location-mode and private-location combinations', async () => {
    const exactFields = normalizeIncidentLocation({
      mode: 'EXACT_PRIVATE',
      privateLocation: exactLocation,
    });

    await expect(
      IncidentModel.create({
        ...incidentInput(),
        location: undefined,
        ...exactFields,
        locationMode: 'APPROXIMATE_ONLY',
      }),
    ).rejects.toThrow(/cannot store a private location/i);

    await expect(
      IncidentModel.create({
        ...incidentInput(),
        location: undefined,
        ...exactFields,
        privateLocation: null,
      }),
    ).rejects.toThrow(/require a private location/i);
  });

  it('hides protected fields from default projections', async () => {
    const created = await repository.create(incidentInput());
    const projected = await IncidentModel.findById(created._id).lean().exec();

    expect(projected).not.toHaveProperty('reporterId');
    expect(projected).not.toHaveProperty('clientSubmissionId');
    expect(projected).not.toHaveProperty('privateLocation');
    expect(projected).not.toHaveProperty('publicCellId');
  });

  it('returns an allowlisted public projection with no private or identifying fields', async () => {
    const created = await repository.create(incidentInput());
    const projection = toPublicIncident(created);

    expect(Object.keys(projection).sort()).toEqual(
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
    for (const forbidden of [
      'reporterId',
      'clientSubmissionId',
      'privateLocation',
      'locationMode',
      'publicCellId',
      'description',
    ]) {
      expect(projection).not.toHaveProperty(forbidden);
    }
  });

  it('rejects incidents outside the initial public status allowlist', async () => {
    const created = await repository.create(incidentInput());
    created.status = 'REJECTED';

    expect(() => toPublicIncident(created)).toThrow(/not eligible for public projection/i);
  });

  it('enforces reporter-scoped client submission uniqueness', async () => {
    const reporterId = new Types.ObjectId().toString();
    const clientSubmissionId = randomUUID();
    const first = incidentInput({ reporterId, clientSubmissionId });

    await repository.create(first);
    await expect(repository.create(first)).rejects.toMatchObject({ code: 11000 });
    await expect(
      repository.create(
        incidentInput({
          reporterId: new Types.ObjectId().toString(),
          clientSubmissionId,
        }),
      ),
    ).resolves.toBeDefined();
  });

  it('defines owner-history and public geospatial indexes', async () => {
    const indexes = await IncidentModel.collection.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { reporterId: 1, clientSubmissionId: 1 },
          unique: true,
        }),
        expect.objectContaining({ key: { reporterId: 1, createdAt: -1, _id: -1 } }),
        expect.objectContaining({ key: { publicLocation: '2dsphere' } }),
      ]),
    );
  });

  it('applies the initial public status and support defaults', async () => {
    const created = await repository.create(incidentInput());

    expect(created.status).toBe('PUBLISHED_UNVERIFIED');
    expect(created.supportCount).toBe(0);
  });
});
