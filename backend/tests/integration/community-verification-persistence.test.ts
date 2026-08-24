import { randomUUID } from 'node:crypto';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  COMMUNITY_EVIDENCE_ALGORITHM_VERSIONS,
  FEEDBACK_EVENT_STATES,
  FEEDBACK_RESPONSES,
  WEIGHT_BASES,
} from '../../src/modules/community-verification/community-verification.types.js';
import { CommunityVerificationRepository } from '../../src/modules/community-verification/community-verification.repository.js';
import { IncidentEvidenceSnapshotModel } from '../../src/modules/community-verification/incident-evidence-snapshot.model.js';
import { IncidentFeedbackModel } from '../../src/modules/community-verification/incident-feedback.model.js';

describe('community verification persistence foundation', () => {
  let mongo: MongoMemoryServer | undefined;
  const repository = new CommunityVerificationRepository();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      binary: { version: '7.0.14' },
    });
    await mongoose.connect(mongo.getUri());
    await Promise.all([
      IncidentFeedbackModel.syncIndexes(),
      IncidentEvidenceSnapshotModel.syncIndexes(),
    ]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      IncidentFeedbackModel.deleteMany({}),
      IncidentEvidenceSnapshotModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('exports the approved persistence enum values', () => {
    expect(FEEDBACK_RESPONSES).toEqual(['SUPPORT', 'RESOLVED', 'DISPUTE', 'UNSURE']);
    expect(FEEDBACK_EVENT_STATES).toEqual(['ACTIVE', 'SUPERSEDED', 'WITHDRAWN']);
    expect(WEIGHT_BASES).toEqual(['BASELINE_V1']);
    expect(COMMUNITY_EVIDENCE_ALGORITHM_VERSIONS).toEqual(['COMMUNITY_EVIDENCE_V1']);
  });

  it('applies server-controlled feedback defaults and protects actor keys', async () => {
    const actorId = new Types.ObjectId().toString();
    const incidentId = new Types.ObjectId().toString();
    const clientFeedbackId = randomUUID();
    const created = await repository.createFeedback({
      incidentId,
      actorId,
      clientFeedbackId,
      response: 'SUPPORT',
    });

    expect(created.state).toBe('ACTIVE');
    expect(created.evidenceWeight).toBe(1);
    expect(created.weightBasis).toBe('BASELINE_V1');
    expect(created.withdrawnAt).toBeNull();

    const projected = await IncidentFeedbackModel.findById(created._id).lean().exec();
    expect(projected).not.toHaveProperty('actorId');
    expect(projected).not.toHaveProperty('clientFeedbackId');

    const selected = await repository.findByIdempotencyKey(actorId, clientFeedbackId);
    expect(selected?.actorId.toString()).toBe(actorId);
    expect(selected?.clientFeedbackId).toBe(clientFeedbackId.toLowerCase());
  });

  it('rejects invalid feedback values and inconsistent server-controlled state', async () => {
    const base = {
      incidentId: new Types.ObjectId(),
      actorId: new Types.ObjectId(),
      clientFeedbackId: randomUUID(),
      response: 'SUPPORT',
    };

    await expect(IncidentFeedbackModel.create({ ...base, response: 'CONFIRMED' })).rejects.toThrow();
    await expect(IncidentFeedbackModel.create({ ...base, clientFeedbackId: 'not-a-uuid' })).rejects.toThrow();
    await expect(IncidentFeedbackModel.create({ ...base, evidenceWeight: 2 })).rejects.toThrow(
      /evidence weight of 1/i,
    );
    await expect(
      IncidentFeedbackModel.create({ ...base, state: 'WITHDRAWN', withdrawnAt: null }),
    ).rejects.toThrow(/withdrawal timestamp/i);
    await expect(
      IncidentFeedbackModel.create({ ...base, state: 'ACTIVE', withdrawnAt: new Date() }),
    ).rejects.toThrow(/only withdrawn feedback/i);
  });

  it('enforces actor idempotency and one active response per actor and incident', async () => {
    const actorId = new Types.ObjectId();
    const incidentId = new Types.ObjectId();
    const first = await IncidentFeedbackModel.create({
      actorId,
      incidentId,
      clientFeedbackId: randomUUID(),
      response: 'SUPPORT',
    });

    await expect(
      IncidentFeedbackModel.create({
        actorId,
        incidentId,
        clientFeedbackId: randomUUID(),
        response: 'RESOLVED',
      }),
    ).rejects.toMatchObject({ code: 11000 });

    first.state = 'SUPERSEDED';
    await first.save();

    await expect(
      IncidentFeedbackModel.create({
        actorId,
        incidentId,
        clientFeedbackId: randomUUID(),
        response: 'RESOLVED',
        supersedesFeedbackId: first._id,
      }),
    ).resolves.toBeDefined();

    const clientFeedbackId = randomUUID();
    await IncidentFeedbackModel.create({
      actorId,
      incidentId: new Types.ObjectId(),
      clientFeedbackId,
      response: 'UNSURE',
    });
    await expect(
      IncidentFeedbackModel.create({
        actorId,
        incidentId: new Types.ObjectId(),
        clientFeedbackId,
        response: 'UNSURE',
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('validates and upserts one internally consistent evidence snapshot per incident', async () => {
    const incidentId = new Types.ObjectId().toString();
    const evaluatedAt = new Date('2026-08-25T10:00:00.000Z');
    const snapshot = await repository.upsertSnapshot({
      incidentId,
      algorithmVersion: 'COMMUNITY_EVIDENCE_V1',
      activeCounts: { support: 2, resolved: 1, dispute: 0, unsure: 1 },
      contributingCounts: { support: 2, resolved: 1, dispute: 0 },
      weightedScores: { support: 2, resolved: 1, dispute: 0 },
      contributingFeedbackCount: 3,
      communityState: 'SUPPORTED',
      supportCount: 2,
      evidenceRevision: 1,
      evaluatedAt,
      nextEvaluationAt: null,
    });

    expect(snapshot.incidentId.toString()).toBe(incidentId);
    expect(snapshot.algorithmVersion).toBe('COMMUNITY_EVIDENCE_V1');
    expect(snapshot.supportCount).toBe(2);
    await expect(
      repository.upsertSnapshot({
        incidentId,
        algorithmVersion: 'COMMUNITY_EVIDENCE_V1',
        activeCounts: { support: 3, resolved: 1, dispute: 0, unsure: 0 },
        contributingCounts: { support: 3, resolved: 1, dispute: 0 },
        weightedScores: { support: 3, resolved: 1, dispute: 0 },
        contributingFeedbackCount: 4,
        communityState: 'SUPPORTED',
        supportCount: 3,
        evidenceRevision: 2,
        evaluatedAt,
        nextEvaluationAt: null,
      }),
    ).resolves.toMatchObject({ evidenceRevision: 2, supportCount: 3 });
    expect(await IncidentEvidenceSnapshotModel.countDocuments({ incidentId })).toBe(1);

    await expect(
      IncidentEvidenceSnapshotModel.create({
        incidentId: new Types.ObjectId(),
        activeCounts: { support: 1, resolved: 0, dispute: 0, unsure: 0 },
        contributingCounts: { support: 1, resolved: 0, dispute: 0 },
        weightedScores: { support: 1, resolved: 0, dispute: 0 },
        contributingFeedbackCount: 1,
        communityState: 'UNVERIFIED',
        supportCount: 0,
        evidenceRevision: 0,
        evaluatedAt,
      }),
    ).rejects.toThrow(/support count must match/i);
  });

  it('defines feedback uniqueness, query, and snapshot indexes', async () => {
    const [feedbackIndexes, snapshotIndexes] = await Promise.all([
      IncidentFeedbackModel.collection.indexes(),
      IncidentEvidenceSnapshotModel.collection.indexes(),
    ]);

    expect(feedbackIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { actorId: 1, clientFeedbackId: 1 },
          unique: true,
        }),
        expect.objectContaining({
          key: { incidentId: 1, actorId: 1 },
          unique: true,
          partialFilterExpression: { state: 'ACTIVE' },
        }),
        expect.objectContaining({ key: { incidentId: 1, state: 1, createdAt: -1 } }),
        expect.objectContaining({ key: { actorId: 1, incidentId: 1, createdAt: -1 } }),
      ]),
    );
    expect(snapshotIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { incidentId: 1 }, unique: true }),
        expect.objectContaining({ key: { nextEvaluationAt: 1 } }),
      ]),
    );
  });
});
