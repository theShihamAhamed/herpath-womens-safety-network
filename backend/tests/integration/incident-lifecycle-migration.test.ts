import { randomUUID } from 'node:crypto';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  applyIncidentLifecycleMigration,
  IncidentLifecycleMigrationError,
  inspectIncidentLifecycleMigration,
  rollbackIncidentLifecycleMigration,
} from '../../src/modules/incidents/incident-lifecycle.migration.js';
import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';
import type {
  CreateIncidentPersistenceInput,
  GeoJsonPoint,
} from '../../src/modules/incidents/incident.types.js';

const exactLocation: GeoJsonPoint = {
  type: 'Point',
  coordinates: [79.8612, 6.9271],
};
const repository = new IncidentRepository();

function incidentInput(): CreateIncidentPersistenceInput {
  return {
    reporterId: new Types.ObjectId().toString(),
    clientSubmissionId: randomUUID(),
    category: 'HARASSMENT',
    severity: 'HIGH',
    occurredAt: new Date('2026-08-18T14:45:00.000Z'),
    description: 'Private migration preservation sentinel',
    location: { mode: 'EXACT_PRIVATE', privateLocation: exactLocation },
  };
}

async function removeLifecycleFields(id: Types.ObjectId): Promise<void> {
  await IncidentModel.collection.updateOne(
    { _id: id },
    {
      $unset: {
        visibilityState: '',
        communityState: '',
        moderationState: '',
        lifecycleRevision: '',
      },
    },
  );
}

describe('incident lifecycle migration', () => {
  let mongo: MongoMemoryServer | undefined;

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

  it('reports aggregate dry-run counts without writing', async () => {
    const created = await repository.create(incidentInput());
    await IncidentModel.collection.updateOne(
      { _id: created._id },
      { $set: { supportCount: 2 } },
    );
    await removeLifecycleFields(created._id);
    const before = await IncidentModel.collection.findOne({ _id: created._id });

    const inspection = await inspectIncidentLifecycleMigration();
    const after = await IncidentModel.collection.findOne({ _id: created._id });

    expect(inspection).toMatchObject({
      totalIncidents: 1,
      missingLifecycleFields: {
        visibilityState: 1,
        communityState: 1,
        moderationState: 1,
        lifecycleRevision: 1,
      },
      partialLifecycleDocuments: 0,
      legacyStatusDistribution: { PUBLISHED_UNVERIFIED: 1 },
      nonZeroSupportCount: 1,
      invalidLifecycleValues: 0,
      unexpectedLegacyStatuses: 0,
    });
    expect(after).toEqual(before);
  });

  it('applies missing defaults idempotently while preserving existing fields', async () => {
    const created = await repository.create(incidentInput());
    await IncidentModel.collection.updateOne(
      { _id: created._id },
      { $set: { supportCount: 3 } },
    );
    await removeLifecycleFields(created._id);
    const before = await IncidentModel.collection.findOne({ _id: created._id });

    const first = await applyIncidentLifecycleMigration();
    const migrated = await IncidentModel.collection.findOne({ _id: created._id });
    const second = await applyIncidentLifecycleMigration();
    const rerun = await IncidentModel.collection.findOne({ _id: created._id });

    expect(first.modifiedFields).toEqual({
      visibilityState: 1,
      communityState: 1,
      moderationState: 1,
      lifecycleRevision: 1,
    });
    expect(migrated).toMatchObject({
      visibilityState: 'PUBLIC',
      communityState: 'UNVERIFIED',
      moderationState: 'NOT_QUEUED',
      lifecycleRevision: 0,
      status: 'PUBLISHED_UNVERIFIED',
      supportCount: 3,
      reporterId: before?.reporterId,
      clientSubmissionId: before?.clientSubmissionId,
      privateLocation: before?.privateLocation,
      publicCellId: before?.publicCellId,
      publicLocation: before?.publicLocation,
      createdAt: before?.createdAt,
      updatedAt: before?.updatedAt,
    });
    expect(second.modifiedFields).toEqual({
      visibilityState: 0,
      communityState: 0,
      moderationState: 0,
      lifecycleRevision: 0,
    });
    expect(rerun).toEqual(migrated);
  });

  it('blocks apply when a legacy incident has an unexpected status', async () => {
    const created = await repository.create(incidentInput());
    await removeLifecycleFields(created._id);
    await IncidentModel.collection.updateOne(
      { _id: created._id },
      { $set: { status: 'REJECTED' } },
    );

    await expect(applyIncidentLifecycleMigration()).rejects.toBeInstanceOf(
      IncidentLifecycleMigrationError,
    );
    const stored = await IncidentModel.collection.findOne({ _id: created._id });
    expect(stored).not.toHaveProperty('visibilityState');
    expect(stored).not.toHaveProperty('communityState');
    expect(stored).not.toHaveProperty('moderationState');
    expect(stored).not.toHaveProperty('lifecycleRevision');
  });

  it('rolls back only safe defaults and leaves progressed records unchanged', async () => {
    const safe = await repository.create(incidentInput());
    const progressed = await repository.create(incidentInput());
    await IncidentModel.collection.updateOne(
      { _id: progressed._id },
      {
        $set: {
          communityState: 'SUPPORTED',
          lifecycleRevision: 1,
          status: 'COMMUNITY_SUPPORTED',
        },
      },
    );

    const result = await rollbackIncidentLifecycleMigration();
    const safeAfter = await IncidentModel.collection.findOne({ _id: safe._id });
    const progressedAfter = await IncidentModel.collection.findOne({ _id: progressed._id });

    expect(result.modifiedDocuments).toBe(1);
    expect(result.skippedProgressedDocuments).toBe(1);
    expect(safeAfter).not.toHaveProperty('visibilityState');
    expect(safeAfter).not.toHaveProperty('communityState');
    expect(safeAfter).not.toHaveProperty('moderationState');
    expect(safeAfter).not.toHaveProperty('lifecycleRevision');
    expect(progressedAfter).toMatchObject({
      visibilityState: 'PUBLIC',
      communityState: 'SUPPORTED',
      moderationState: 'NOT_QUEUED',
      lifecycleRevision: 1,
      status: 'COMMUNITY_SUPPORTED',
    });
  });
});
