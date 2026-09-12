import { randomUUID } from 'node:crypto';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CommunityVerificationRateLimiter } from '../../src/modules/community-verification/community-verification.rate-limiter.js';
import { CommunityVerificationRepository } from '../../src/modules/community-verification/community-verification.repository.js';
import { CommunityVerificationService } from '../../src/modules/community-verification/community-verification.service.js';
import { IncidentEvidenceSnapshotModel } from '../../src/modules/community-verification/incident-evidence-snapshot.model.js';
import { IncidentFeedbackModel } from '../../src/modules/community-verification/incident-feedback.model.js';
import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';

const evaluatedAt = new Date('2026-08-25T12:00:00.000Z');
const expiredAt = new Date('2026-07-26T12:00:00.000Z');

describe('community evidence reconciliation', () => {
  let mongo: MongoMemoryReplSet | undefined;
  const verification = new CommunityVerificationRepository();
  const incidents = new IncidentRepository();
  const service = new CommunityVerificationService(
    verification,
    incidents,
    new CommunityVerificationRateLimiter({ windowMs: 900_000, max: 10 }),
  );

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({
      binary: { version: '7.0.14' },
      replSet: { count: 1 },
    });
    await mongoose.connect(mongo.getUri());
    await Promise.all([
      IncidentModel.syncIndexes(),
      IncidentFeedbackModel.syncIndexes(),
      IncidentEvidenceSnapshotModel.syncIndexes(),
    ]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      IncidentModel.deleteMany({}),
      IncidentFeedbackModel.deleteMany({}),
      IncidentEvidenceSnapshotModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  async function seedExpiredSupportedIncident(): Promise<string> {
    const reporterId = new Types.ObjectId().toString();
    const incident = await incidents.create({
      reporterId,
      clientSubmissionId: randomUUID(),
      category: 'THEFT',
      severity: 'MEDIUM',
      occurredAt: new Date('2026-07-01T00:00:00.000Z'),
      location: {
        mode: 'EXACT_PRIVATE',
        privateLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
      },
    });
    await IncidentModel.updateOne(
      { _id: incident._id },
      {
        $set: {
          communityState: 'SUPPORTED',
          status: 'COMMUNITY_SUPPORTED',
          supportCount: 3,
          lifecycleRevision: 1,
        },
      },
    );

    await IncidentFeedbackModel.collection.insertMany(
      ['a', 'b', 'c'].map(() => ({
        incidentId: incident._id,
        actorId: new Types.ObjectId(),
        clientFeedbackId: randomUUID(),
        response: 'SUPPORT',
        state: 'ACTIVE',
        evidenceWeight: 1,
        weightBasis: 'BASELINE_V1',
        withdrawnAt: null,
        createdAt: expiredAt,
        updatedAt: expiredAt,
      })),
    );
    await verification.upsertSnapshot({
      incidentId: incident._id.toString(),
      algorithmVersion: 'COMMUNITY_EVIDENCE_V1',
      activeCounts: { support: 3, resolved: 0, dispute: 0, unsure: 0 },
      contributingCounts: { support: 3, resolved: 0, dispute: 0 },
      weightedScores: { support: 3, resolved: 0, dispute: 0 },
      contributingFeedbackCount: 3,
      communityState: 'SUPPORTED',
      supportCount: 3,
      evidenceRevision: 1,
      evaluatedAt: expiredAt,
      nextEvaluationAt: evaluatedAt,
    });
    return incident._id.toString();
  }

  it('reports due work without writing in dry-run mode', async () => {
    const incidentId = await seedExpiredSupportedIncident();
    const result = await service.reconcileDueEvidence(evaluatedAt, 100, false);

    expect(result).toEqual({ dueCount: 1, reconciledCount: 0 });
    expect(await IncidentModel.findById(incidentId).lean()).toMatchObject({
      communityState: 'SUPPORTED',
      supportCount: 3,
    });
  });

  it('recalculates due evidence once and is idempotent on rerun', async () => {
    const incidentId = await seedExpiredSupportedIncident();
    expect(await service.reconcileDueEvidence(evaluatedAt, 100, true)).toEqual({
      dueCount: 1,
      reconciledCount: 1,
    });

    expect(await IncidentModel.findById(incidentId).lean()).toMatchObject({
      visibilityState: 'PUBLIC',
      communityState: 'STALE',
      moderationState: 'NOT_QUEUED',
      status: 'PUBLISHED_UNVERIFIED',
      supportCount: 0,
      lifecycleRevision: 2,
    });
    expect(await IncidentEvidenceSnapshotModel.findOne({ incidentId }).lean()).toMatchObject({
      communityState: 'STALE',
      supportCount: 0,
      evidenceRevision: 2,
      nextEvaluationAt: null,
    });

    expect(await service.reconcileDueEvidence(evaluatedAt, 100, true)).toEqual({
      dueCount: 0,
      reconciledCount: 0,
    });
  });
});
