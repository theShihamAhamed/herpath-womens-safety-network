import { randomUUID } from 'node:crypto';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';
import { ModerationAuditLogModel } from '../../src/modules/moderation/moderation-audit.model.js';
import { ModerationCaseModel } from '../../src/modules/moderation/moderation-case.model.js';
import { ModerationIntakeReconciliationService } from '../../src/modules/moderation/moderation-intake-reconciliation.service.js';
import { ModerationRepository } from '../../src/modules/moderation/moderation.repository.js';

const incidents = new IncidentRepository();
const moderation = new ModerationRepository();
const evaluatedAt = new Date('2026-08-26T10:00:00.000Z');

interface SeedIncidentOptions {
  communityState?: 'CONFLICTED' | 'SUPPORTED';
  moderationState?: 'NOT_QUEUED' | 'QUEUED' | 'RESOLVED';
  lifecycleRevision?: number;
  supportCount?: number;
}

async function seedIncident(options: SeedIncidentOptions = {}): Promise<string> {
  const incident = await incidents.create({
    reporterId: new Types.ObjectId().toString(),
    clientSubmissionId: randomUUID(),
    category: 'HARASSMENT',
    severity: 'HIGH',
    occurredAt: new Date('2026-08-24T10:00:00.000Z'),
    location: {
      mode: 'EXACT_PRIVATE',
      privateLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
    },
  });
  const communityState = options.communityState ?? 'CONFLICTED';
  const moderationState = options.moderationState ?? 'NOT_QUEUED';
  const status =
    moderationState === 'RESOLVED'
      ? 'MODERATOR_REVIEWED'
      : communityState === 'CONFLICTED'
        ? 'DISPUTED'
        : 'COMMUNITY_SUPPORTED';

  await IncidentModel.collection.updateOne(
    { _id: incident._id },
    {
      $set: {
        communityState,
        moderationState,
        lifecycleRevision: options.lifecycleRevision ?? 1,
        supportCount: options.supportCount ?? 3,
        status,
      },
    },
  );
  return incident._id.toString();
}

function createService(): ModerationIntakeReconciliationService {
  return new ModerationIntakeReconciliationService(incidents, moderation, () => evaluatedAt);
}

describe('moderation conflict intake reconciliation', () => {
  let mongo: MongoMemoryReplSet | undefined;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({
      binary: { version: '7.0.14' },
      replSet: { count: 1 },
    });
    await mongoose.connect(mongo.getUri());
    await Promise.all([
      IncidentModel.syncIndexes(),
      ModerationCaseModel.syncIndexes(),
      ModerationAuditLogModel.syncIndexes(),
    ]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      IncidentModel.deleteMany({}),
      ModerationCaseModel.collection.deleteMany({}),
      ModerationAuditLogModel.collection.deleteMany({}),
    ]);
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('reports eligible incidents in dry-run mode without writing', async () => {
    const incidentId = await seedIncident();

    const result = await createService().reconcile({ apply: false });

    expect(result).toEqual({
      eligibleIncidents: [
        {
          incidentId,
          communityState: 'CONFLICTED',
          moderationState: 'NOT_QUEUED',
        },
      ],
      queuedCount: 0,
    });
    expect(await ModerationCaseModel.countDocuments()).toBe(0);
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
    expect(await IncidentModel.findById(incidentId).lean()).toMatchObject({
      moderationState: 'NOT_QUEUED',
      lifecycleRevision: 1,
    });
  });

  it('creates a case and queues a conflicted incident without changing evidence or visibility', async () => {
    const incidentId = await seedIncident({ supportCount: 7, lifecycleRevision: 4 });

    const result = await createService().reconcile({ apply: true });

    expect(result.queuedCount).toBe(1);
    const moderationCase = await ModerationCaseModel.findOne({ incidentId }).lean();
    expect(moderationCase).toMatchObject({
      sources: ['COMMUNITY_CONFLICT'],
      state: 'QUEUED',
      priority: 'NORMAL',
      priorityRank: 1,
      flagCount: 0,
      caseRevision: 0,
      queuedAt: evaluatedAt,
      latestActivityAt: evaluatedAt,
    });
    const incident = await IncidentModel.findById(incidentId).lean();
    expect(incident).toMatchObject({
      visibilityState: 'PUBLIC',
      communityState: 'CONFLICTED',
      moderationState: 'QUEUED',
      lifecycleRevision: 5,
      supportCount: 7,
      status: 'DISPUTED',
    });
    expect(await ModerationAuditLogModel.findOne({ incidentId }).lean()).toMatchObject({
      actorType: 'SYSTEM',
      action: 'CASE_QUEUED',
      previousCaseState: null,
      newCaseState: { state: 'QUEUED', priority: 'NORMAL', caseRevision: 0 },
      previousIncidentLifecycle: {
        visibilityState: 'PUBLIC',
        communityState: 'CONFLICTED',
        moderationState: 'NOT_QUEUED',
        lifecycleRevision: 4,
        status: 'DISPUTED',
      },
      newIncidentLifecycle: {
        visibilityState: 'PUBLIC',
        communityState: 'CONFLICTED',
        moderationState: 'QUEUED',
        lifecycleRevision: 5,
        status: 'DISPUTED',
      },
    });
  });

  it('skips incidents that are already queued', async () => {
    const incidentId = await seedIncident({ moderationState: 'QUEUED' });

    const result = await createService().reconcile({ apply: true });

    expect(result).toEqual({ eligibleIncidents: [], queuedCount: 0 });
    expect(await ModerationCaseModel.countDocuments()).toBe(0);
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
    expect(await IncidentModel.findById(incidentId).lean()).toMatchObject({
      moderationState: 'QUEUED',
      lifecycleRevision: 1,
    });
  });

  it('does not reopen resolved moderation cases', async () => {
    const incidentId = await seedIncident({
      moderationState: 'RESOLVED',
      lifecycleRevision: 8,
    });
    const moderationCase = await moderation.createCase({
      incidentId,
      sources: ['COMMUNITY_CONFLICT'],
      priority: 'NORMAL',
      flagCount: 0,
      reasonCounts: {
        INACCURATE: 0,
        SPAM: 0,
        DUPLICATE: 0,
        HARMFUL_CONTENT: 0,
        PRIVACY_VIOLATION: 0,
        MISLEADING: 0,
        OTHER: 0,
      },
      queuedAt: evaluatedAt,
      latestActivityAt: evaluatedAt,
    });
    await ModerationCaseModel.collection.updateOne(
      { _id: moderationCase._id },
      {
        $set: {
          state: 'RESOLVED',
          assignedModeratorId: new Types.ObjectId(),
          resolution: 'NO_ACTION',
          resolutionReason: 'Review completed',
          reviewStartedAt: evaluatedAt,
          resolvedAt: evaluatedAt,
        },
      },
    );

    const result = await createService().reconcile({ apply: true });

    expect(result).toEqual({ eligibleIncidents: [], queuedCount: 0 });
    expect(await ModerationCaseModel.findById(moderationCase._id).lean()).toMatchObject({
      state: 'RESOLVED',
      resolution: 'NO_ACTION',
    });
    expect(await IncidentModel.findById(incidentId).lean()).toMatchObject({
      moderationState: 'RESOLVED',
      lifecycleRevision: 8,
    });
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
  });

  it('is idempotent when apply runs repeatedly', async () => {
    const incidentId = await seedIncident({ lifecycleRevision: 2 });
    const service = createService();

    const first = await service.reconcile({ apply: true });
    const second = await service.reconcile({ apply: true });

    expect(first.queuedCount).toBe(1);
    expect(second).toEqual({ eligibleIncidents: [], queuedCount: 0 });
    expect(await ModerationCaseModel.countDocuments({ incidentId })).toBe(1);
    expect(await ModerationAuditLogModel.countDocuments({ incidentId })).toBe(1);
    expect(await IncidentModel.findById(incidentId).lean()).toMatchObject({
      moderationState: 'QUEUED',
      lifecycleRevision: 3,
    });
  });

  it('rolls back the case and lifecycle update when audit creation fails', async () => {
    const incidentId = await seedIncident({ lifecycleRevision: 6 });
    vi.spyOn(ModerationAuditLogModel.prototype, 'save').mockRejectedValueOnce(
      new Error('audit write failed'),
    );

    await expect(createService().reconcile({ apply: true })).rejects.toThrow(
      'audit write failed',
    );

    expect(await ModerationCaseModel.countDocuments()).toBe(0);
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
    expect(await IncidentModel.findById(incidentId).lean()).toMatchObject({
      visibilityState: 'PUBLIC',
      communityState: 'CONFLICTED',
      moderationState: 'NOT_QUEUED',
      lifecycleRevision: 6,
      supportCount: 3,
      status: 'DISPUTED',
    });
  });

  it('ignores non-conflicted community evidence', async () => {
    await seedIncident({ communityState: 'SUPPORTED' });

    const result = await createService().reconcile({ apply: true });

    expect(result).toEqual({ eligibleIncidents: [], queuedCount: 0 });
    expect(await ModerationCaseModel.countDocuments()).toBe(0);
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
  });
});
