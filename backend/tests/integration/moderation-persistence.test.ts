import { randomUUID } from 'node:crypto';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { IncidentFlagModel } from '../../src/modules/moderation/incident-flag.model.js';
import { ModerationAuditLogModel } from '../../src/modules/moderation/moderation-audit.model.js';
import { ModerationCaseModel } from '../../src/modules/moderation/moderation-case.model.js';
import { ModerationRepository } from '../../src/modules/moderation/moderation.repository.js';
import {
  INCIDENT_FLAG_REASONS,
  MODERATION_AUDIT_ACTIONS,
  MODERATION_AUDIT_ACTOR_TYPES,
  MODERATION_CASE_SOURCES,
  MODERATION_CASE_STATES,
  MODERATION_PRIORITIES,
  MODERATION_PRIORITY_RANKS,
  MODERATION_RESOLUTIONS,
  type IncidentFlagReasonCounts,
  type IncidentLifecycleAuditSnapshot,
} from '../../src/modules/moderation/moderation.types.js';

const repository = new ModerationRepository();

function emptyReasonCounts(): IncidentFlagReasonCounts {
  return {
    INACCURATE: 0,
    SPAM: 0,
    DUPLICATE: 0,
    HARMFUL_CONTENT: 0,
    PRIVACY_VIOLATION: 0,
    MISLEADING: 0,
    OTHER: 0,
  };
}

function lifecycleSnapshot(): IncidentLifecycleAuditSnapshot {
  return {
    visibilityState: 'PUBLIC',
    communityState: 'UNVERIFIED',
    moderationState: 'QUEUED',
    lifecycleRevision: 1,
    status: 'PUBLISHED_UNVERIFIED',
  };
}

describe('moderation persistence foundation', () => {
  let mongo: MongoMemoryServer | undefined;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([
      IncidentFlagModel.syncIndexes(),
      ModerationCaseModel.syncIndexes(),
      ModerationAuditLogModel.syncIndexes(),
    ]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      IncidentFlagModel.collection.deleteMany({}),
      ModerationCaseModel.collection.deleteMany({}),
      ModerationAuditLogModel.collection.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('exports the approved moderation persistence constants', () => {
    expect(INCIDENT_FLAG_REASONS).toEqual([
      'INACCURATE',
      'SPAM',
      'DUPLICATE',
      'HARMFUL_CONTENT',
      'PRIVACY_VIOLATION',
      'MISLEADING',
      'OTHER',
    ]);
    expect(MODERATION_CASE_STATES).toEqual(['QUEUED', 'IN_REVIEW', 'RESOLVED']);
    expect(MODERATION_CASE_SOURCES).toEqual(['USER_FLAG', 'COMMUNITY_CONFLICT']);
    expect(MODERATION_PRIORITIES).toEqual(['NORMAL', 'HIGH', 'URGENT']);
    expect(MODERATION_PRIORITY_RANKS).toEqual({ NORMAL: 1, HIGH: 2, URGENT: 3 });
    expect(MODERATION_RESOLUTIONS).toEqual([
      'NO_ACTION',
      'HIDDEN',
      'RESTORED',
      'ARCHIVED',
      'ARCHIVED_DUPLICATE',
    ]);
    expect(MODERATION_AUDIT_ACTOR_TYPES).toEqual(['SYSTEM', 'MODERATOR']);
    expect(MODERATION_AUDIT_ACTIONS).toContain('CASE_QUEUED');
  });

  it('protects flag actor data and enforces UUID and immutable flag records', async () => {
    const incidentId = new Types.ObjectId().toString();
    const actorId = new Types.ObjectId().toString();
    const clientFlagId = randomUUID();
    const flag = await repository.createFlag({
      incidentId,
      actorId,
      clientFlagId,
      reason: 'PRIVACY_VIOLATION',
      details: 'Potentially identifying content',
    });

    const projected = await IncidentFlagModel.findById(flag._id).lean().exec();
    expect(projected).not.toHaveProperty('actorId');
    expect(projected).not.toHaveProperty('clientFlagId');
    expect(projected).not.toHaveProperty('details');

    const selected = await repository.findFlagByIdempotencyKey(actorId, clientFlagId);
    expect(selected?.actorId.toString()).toBe(actorId);
    expect(selected?.clientFlagId).toBe(clientFlagId.toLowerCase());
    expect(selected?.details).toBe('Potentially identifying content');

    await expect(
      IncidentFlagModel.create({
        incidentId: new Types.ObjectId(),
        actorId: new Types.ObjectId(),
        clientFlagId: 'not-a-uuid',
        reason: 'SPAM',
      }),
    ).rejects.toThrow();
    await expect(IncidentFlagModel.updateOne({ _id: flag._id }, { reason: 'SPAM' })).rejects.toThrow(
      /immutable/i,
    );
    await expect(IncidentFlagModel.deleteOne({ _id: flag._id })).rejects.toThrow(/immutable/i);
    flag.reason = 'SPAM';
    await expect(flag.save()).rejects.toThrow(/immutable/i);
  });

  it('enforces actor-scoped flag idempotency and one flag per actor and incident', async () => {
    const actorId = new Types.ObjectId().toString();
    const incidentId = new Types.ObjectId().toString();
    const clientFlagId = randomUUID();
    await repository.createFlag({
      actorId,
      incidentId,
      clientFlagId,
      reason: 'SPAM',
    });

    await expect(
      repository.createFlag({
        actorId,
        incidentId: new Types.ObjectId().toString(),
        clientFlagId,
        reason: 'INACCURATE',
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await expect(
      repository.createFlag({
        actorId,
        incidentId,
        clientFlagId: randomUUID(),
        reason: 'DUPLICATE',
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await expect(
      repository.createFlag({
        actorId: new Types.ObjectId().toString(),
        incidentId: new Types.ObjectId().toString(),
        clientFlagId,
        reason: 'OTHER',
      }),
    ).resolves.toBeDefined();
  });

  it('persists protected case fields and rejects inconsistent case aggregates', async () => {
    const incidentId = new Types.ObjectId().toString();
    const counts = emptyReasonCounts();
    counts.SPAM = 2;
    const queuedAt = new Date('2026-08-26T08:00:00.000Z');
    const moderationCase = await repository.createCase({
      incidentId,
      sources: ['USER_FLAG'],
      priority: 'HIGH',
      flagCount: 2,
      reasonCounts: counts,
      queuedAt,
      latestActivityAt: queuedAt,
    });

    expect(moderationCase.state).toBe('QUEUED');
    expect(moderationCase.priorityRank).toBe(2);
    expect(moderationCase.caseRevision).toBe(0);

    const projected = await ModerationCaseModel.findById(moderationCase._id).lean().exec();
    expect(projected).not.toHaveProperty('assignedModeratorId');
    expect(projected).not.toHaveProperty('resolutionReason');

    await expect(
      ModerationCaseModel.create({
        incidentId: new Types.ObjectId(),
        sources: ['USER_FLAG'],
        priority: 'HIGH',
        priorityRank: 1,
        flagCount: 0,
        reasonCounts: emptyReasonCounts(),
        queuedAt,
        latestActivityAt: queuedAt,
      }),
    ).rejects.toThrow(/priority rank/i);

    await expect(
      ModerationCaseModel.create({
        incidentId: new Types.ObjectId(),
        sources: ['USER_FLAG'],
        flagCount: 1,
        reasonCounts: emptyReasonCounts(),
        queuedAt,
        latestActivityAt: queuedAt,
      }),
    ).rejects.toThrow(/flag count/i);
  });

  it('enforces one case per incident and conditionally increments case revision', async () => {
    const incidentId = new Types.ObjectId().toString();
    const queuedAt = new Date('2026-08-26T08:00:00.000Z');
    const moderationCase = await repository.createCase({
      incidentId,
      sources: ['COMMUNITY_CONFLICT'],
      priority: 'NORMAL',
      flagCount: 0,
      reasonCounts: emptyReasonCounts(),
      queuedAt,
      latestActivityAt: queuedAt,
    });

    await expect(
      repository.createCase({
        incidentId,
        sources: ['USER_FLAG'],
        priority: 'URGENT',
        flagCount: 0,
        reasonCounts: emptyReasonCounts(),
        queuedAt,
        latestActivityAt: queuedAt,
      }),
    ).rejects.toMatchObject({ code: 11000 });

    const moderatorId = new Types.ObjectId().toString();
    const updated = await repository.updateCaseWithRevision(
      moderationCase._id.toString(),
      0,
      {
        sources: ['COMMUNITY_CONFLICT'],
        state: 'IN_REVIEW',
        priority: 'HIGH',
        assignedModeratorId: moderatorId,
        flagCount: 0,
        reasonCounts: emptyReasonCounts(),
        resolution: null,
        resolutionReason: null,
        relatedIncidentId: null,
        queuedAt,
        reviewStartedAt: new Date('2026-08-26T08:05:00.000Z'),
        resolvedAt: null,
        latestActivityAt: new Date('2026-08-26T08:05:00.000Z'),
      },
    );

    expect(updated?.caseRevision).toBe(1);
    expect(updated?.priorityRank).toBe(2);
    expect(updated?.assignedModeratorId?.toString()).toBe(moderatorId);

    const staleUpdate = await repository.updateCaseWithRevision(
      moderationCase._id.toString(),
      0,
      {
        sources: ['COMMUNITY_CONFLICT'],
        state: 'QUEUED',
        priority: 'NORMAL',
        assignedModeratorId: null,
        flagCount: 0,
        reasonCounts: emptyReasonCounts(),
        resolution: null,
        resolutionReason: null,
        relatedIncidentId: null,
        queuedAt,
        reviewStartedAt: null,
        resolvedAt: null,
        latestActivityAt: queuedAt,
      },
    );
    expect(staleUpdate).toBeNull();
  });

  it('stores append-only audit records without location or default actor leakage', async () => {
    const caseId = new Types.ObjectId().toString();
    const incidentId = new Types.ObjectId().toString();
    const moderatorId = new Types.ObjectId().toString();
    const clientActionId = randomUUID();
    const audit = await repository.createAuditLog({
      caseId,
      incidentId,
      actorType: 'MODERATOR',
      moderatorId,
      clientActionId,
      action: 'CASE_CLAIMED',
      reason: 'Claimed for review',
      previousCaseState: { state: 'QUEUED', priority: 'NORMAL', caseRevision: 0 },
      newCaseState: { state: 'IN_REVIEW', priority: 'NORMAL', caseRevision: 1 },
      previousIncidentLifecycle: lifecycleSnapshot(),
      newIncidentLifecycle: { ...lifecycleSnapshot(), moderationState: 'IN_REVIEW' },
      requestId: 'request-1',
    });

    const projected = await ModerationAuditLogModel.findById(audit._id).lean().exec();
    expect(projected).not.toHaveProperty('moderatorId');
    expect(projected).not.toHaveProperty('clientActionId');
    expect(projected).not.toHaveProperty('reason');
    expect(projected).not.toHaveProperty('requestId');
    expect(projected).not.toHaveProperty('privateLocation');
    expect(projected).not.toHaveProperty('reporterId');

    const selected = await repository.findAuditByIdempotencyKey(moderatorId, clientActionId);
    expect(selected?.moderatorId?.toString()).toBe(moderatorId);
    expect(selected?.clientActionId).toBe(clientActionId.toLowerCase());

    await expect(
      ModerationAuditLogModel.updateOne({ _id: audit._id }, { reason: 'Changed' }),
    ).rejects.toThrow(/append-only/i);
    await expect(ModerationAuditLogModel.deleteOne({ _id: audit._id })).rejects.toThrow(
      /append-only/i,
    );
    audit.reason = 'Changed';
    await expect(audit.save()).rejects.toThrow(/append-only/i);
  });

  it('enforces moderator audit idempotency and actor identity rules', async () => {
    const moderatorId = new Types.ObjectId().toString();
    const clientActionId = randomUUID();
    const input = {
      caseId: new Types.ObjectId().toString(),
      incidentId: new Types.ObjectId().toString(),
      actorType: 'MODERATOR' as const,
      moderatorId,
      clientActionId,
      action: 'DECISION_NO_ACTION' as const,
      reason: 'Report remains visible',
      previousCaseState: { state: 'IN_REVIEW' as const, priority: 'NORMAL' as const, caseRevision: 1 },
      newCaseState: { state: 'RESOLVED' as const, priority: 'NORMAL' as const, caseRevision: 2 },
      previousIncidentLifecycle: lifecycleSnapshot(),
      newIncidentLifecycle: { ...lifecycleSnapshot(), moderationState: 'RESOLVED' as const },
    };
    await repository.createAuditLog(input);

    await expect(
      repository.createAuditLog({
        ...input,
        caseId: new Types.ObjectId().toString(),
        incidentId: new Types.ObjectId().toString(),
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await expect(
      ModerationAuditLogModel.create({
        ...input,
        caseId: new Types.ObjectId(),
        incidentId: new Types.ObjectId(),
        moderatorId: null,
      }),
    ).rejects.toThrow(/require a moderator/i);
    await expect(
      ModerationAuditLogModel.create({
        ...input,
        caseId: new Types.ObjectId(),
        incidentId: new Types.ObjectId(),
        actorType: 'SYSTEM',
      }),
    ).rejects.toThrow(/cannot contain moderator identity/i);
  });

  it('defines all flag, case queue, and audit indexes', async () => {
    const [flagIndexes, caseIndexes, auditIndexes] = await Promise.all([
      IncidentFlagModel.collection.indexes(),
      ModerationCaseModel.collection.indexes(),
      ModerationAuditLogModel.collection.indexes(),
    ]);

    expect(flagIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { actorId: 1, clientFlagId: 1 }, unique: true }),
        expect.objectContaining({ key: { incidentId: 1, actorId: 1 }, unique: true }),
        expect.objectContaining({ key: { incidentId: 1, reason: 1, createdAt: -1, _id: -1 } }),
      ]),
    );
    expect(caseIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { incidentId: 1 }, unique: true }),
        expect.objectContaining({
          key: { state: 1, priorityRank: -1, latestActivityAt: -1, _id: -1 },
        }),
        expect.objectContaining({
          key: { assignedModeratorId: 1, state: 1, latestActivityAt: -1 },
        }),
      ]),
    );
    expect(auditIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { caseId: 1, createdAt: 1, _id: 1 } }),
        expect.objectContaining({ key: { incidentId: 1, createdAt: 1, _id: 1 } }),
        expect.objectContaining({ key: { moderatorId: 1, createdAt: -1, _id: -1 } }),
        expect.objectContaining({
          key: { moderatorId: 1, clientActionId: 1 },
          unique: true,
        }),
      ]),
    );
  });

  it('accepts caller-provided sessions on persistence methods', async () => {
    const session = await mongoose.startSession();
    try {
      const flag = await repository.createFlag(
        {
          incidentId: new Types.ObjectId().toString(),
          actorId: new Types.ObjectId().toString(),
          clientFlagId: randomUUID(),
          reason: 'OTHER',
        },
        session,
      );
      expect(flag).toBeDefined();
    } finally {
      await session.endSession();
    }
  });
});
