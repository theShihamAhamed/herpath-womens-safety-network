import { randomUUID } from 'node:crypto';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';
import { SessionModel } from '../../src/modules/auth/session.model.js';
import { IncidentEvidenceSnapshotModel } from '../../src/modules/community-verification/incident-evidence-snapshot.model.js';
import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';
import { IncidentFlagModel } from '../../src/modules/moderation/incident-flag.model.js';
import { ModerationAuditLogModel } from '../../src/modules/moderation/moderation-audit.model.js';
import { ModerationCaseModel } from '../../src/modules/moderation/moderation-case.model.js';
import { ModerationRepository } from '../../src/modules/moderation/moderation.repository.js';
import type {
  IncidentFlagReasonCounts,
  ModerationCaseState,
  ModerationPriority,
} from '../../src/modules/moderation/moderation.types.js';
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
  feedbackRateLimitWindowMs: 900_000,
  feedbackRateLimitMax: 10,
  flagRateLimitWindowMs: 900_000,
  flagRateLimitMax: 5,
  trustProxy: false,
  accessTokenSecret: 'test-only-access-token-secret-at-least-32-chars',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  jwtIssuer: 'herpath-test-api',
  jwtAudience: 'herpath-test-client',
};

const silentLogger = pino({ level: 'silent' });
const incidents = new IncidentRepository();
const moderation = new ModerationRepository();
const password = 'Correct Horse Battery 42!';

interface TestActor {
  id: string;
  token: string;
}

interface SeedCaseOptions {
  state?: ModerationCaseState;
  priority?: ModerationPriority;
  assignedModeratorId?: string;
  latestActivityAt?: Date;
  hidden?: boolean;
}

interface SeededCase {
  caseId: string;
  incidentId: string;
  caseRevision: number;
  lifecycleRevision: number;
}

function reasonCounts(): IncidentFlagReasonCounts {
  return {
    INACCURATE: 0,
    SPAM: 1,
    DUPLICATE: 0,
    HARMFUL_CONTENT: 0,
    PRIVACY_VIOLATION: 0,
    MISLEADING: 0,
    OTHER: 0,
  };
}

describe('moderator case queue workflow API', () => {
  let mongo: MongoMemoryReplSet | undefined;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({
      binary: { version: '7.0.14' },
      replSet: { count: 1 },
    });
    await mongoose.connect(mongo.getUri());
    await Promise.all([
      IncidentModel.syncIndexes(),
      IncidentFlagModel.syncIndexes(),
      ModerationCaseModel.syncIndexes(),
      ModerationAuditLogModel.syncIndexes(),
      IncidentEvidenceSnapshotModel.syncIndexes(),
    ]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      SessionModel.deleteMany({}),
      IncidentModel.deleteMany({}),
      IncidentFlagModel.collection.deleteMany({}),
      ModerationCaseModel.collection.deleteMany({}),
      ModerationAuditLogModel.collection.deleteMany({}),
      IncidentEvidenceSnapshotModel.deleteMany({}),
    ]);
    app = createApp({ config, logger: silentLogger });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  async function createUser(): Promise<TestActor> {
    const response = await request(app)
      .post('/api/v1/auth/anonymous')
      .set('Content-Length', '0')
      .expect(201);
    return {
      id: response.body.data.user.id as string,
      token: response.body.data.accessToken as string,
    };
  }

  async function createModerator(): Promise<TestActor> {
    const email = `${randomUUID()}@example.com`;
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Case Moderator', email, password })
      .expect(201);
    const id = registered.body.data.user.id as string;
    await UserModel.updateOne({ _id: id }, { $set: { role: 'MODERATOR' } });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return { id, token: login.body.data.accessToken as string };
  }

  function authorization(actor: TestActor): Record<string, string> {
    return { Authorization: `Bearer ${actor.token}` };
  }

  async function seedCase(
    reporterId: string,
    options: SeedCaseOptions = {},
  ): Promise<SeededCase> {
    const state = options.state ?? 'QUEUED';
    const priority = options.priority ?? 'NORMAL';
    const latestActivityAt = options.latestActivityAt ?? new Date();
    const incident = await incidents.create({
      reporterId,
      clientSubmissionId: randomUUID(),
      category: 'HARASSMENT',
      severity: 'HIGH',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      description: 'Safe incident summary for moderator review',
      location: {
        mode: 'EXACT_PRIVATE',
        privateLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
      },
    });
    const lifecycleRevision = state === 'QUEUED' ? 1 : state === 'IN_REVIEW' ? 2 : 3;
    const visibilityState = options.hidden ? 'HIDDEN' : 'PUBLIC';
    const status = options.hidden
      ? 'REJECTED'
      : state === 'RESOLVED'
        ? 'MODERATOR_REVIEWED'
        : 'PUBLISHED_UNVERIFIED';
    await IncidentModel.collection.updateOne(
      { _id: incident._id },
      {
        $set: {
          visibilityState,
          moderationState: state,
          lifecycleRevision,
          status,
        },
      },
    );

    const moderationCase = await moderation.createCase({
      incidentId: incident._id.toString(),
      sources: ['USER_FLAG'],
      priority,
      flagCount: 1,
      reasonCounts: reasonCounts(),
      queuedAt: new Date('2026-08-25T10:00:00.000Z'),
      latestActivityAt,
    });
    if (state !== 'QUEUED') {
      const assignedModeratorId = new Types.ObjectId(
        options.assignedModeratorId ?? new Types.ObjectId().toString(),
      );
      await ModerationCaseModel.collection.updateOne(
        { _id: moderationCase._id },
        {
          $set: {
            state,
            assignedModeratorId,
            reviewStartedAt: new Date('2026-08-25T11:00:00.000Z'),
            ...(state === 'RESOLVED'
              ? {
                  resolution: 'NO_ACTION',
                  resolutionReason: 'Previously resolved after review',
                  resolvedAt: new Date('2026-08-25T12:00:00.000Z'),
                }
              : {}),
          },
        },
      );
    }
    return {
      caseId: moderationCase._id.toString(),
      incidentId: incident._id.toString(),
      caseRevision: 0,
      lifecycleRevision,
    };
  }

  it('requires a moderator for queue, detail, and workflow mutations', async () => {
    const user = await createUser();
    const reporter = await createUser();
    const seeded = await seedCase(reporter.id);

    await request(app).get('/api/v1/moderation/cases').expect(401);
    await request(app)
      .get('/api/v1/moderation/cases')
      .set(authorization(user))
      .expect(403);
    await request(app)
      .get(`/api/v1/moderation/cases/${seeded.caseId}`)
      .set(authorization(user))
      .expect(403);
    await request(app)
      .post(`/api/v1/moderation/cases/${seeded.caseId}/claim`)
      .set(authorization(user))
      .send({
        clientActionId: randomUUID(),
        expectedCaseRevision: 0,
        expectedLifecycleRevision: 1,
      })
      .expect(403);
  });

  it('filters and paginates the queue without exposing moderator identities', async () => {
    const moderator = await createModerator();
    const otherModerator = await createModerator();
    const reporter = await createUser();
    await seedCase(reporter.id, {
      priority: 'NORMAL',
      latestActivityAt: new Date('2026-08-25T10:00:00.000Z'),
    });
    const urgent = await seedCase(reporter.id, {
      priority: 'URGENT',
      latestActivityAt: new Date('2026-08-25T11:00:00.000Z'),
    });
    await seedCase(reporter.id, {
      state: 'IN_REVIEW',
      priority: 'HIGH',
      assignedModeratorId: moderator.id,
      latestActivityAt: new Date('2026-08-25T12:00:00.000Z'),
    });
    await seedCase(reporter.id, {
      state: 'IN_REVIEW',
      priority: 'HIGH',
      assignedModeratorId: otherModerator.id,
      latestActivityAt: new Date('2026-08-25T13:00:00.000Z'),
    });

    const firstPage = await request(app)
      .get('/api/v1/moderation/cases?assignment=UNASSIGNED&limit=1')
      .set(authorization(moderator))
      .expect(200);
    expect(firstPage.body.data.items).toHaveLength(1);
    expect(firstPage.body.data.items[0]).toMatchObject({
      id: urgent.caseId,
      priority: 'URGENT',
      assignment: { state: 'UNASSIGNED' },
    });
    expect(firstPage.body.data.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app)
      .get(
        `/api/v1/moderation/cases?assignment=UNASSIGNED&limit=1&cursor=${encodeURIComponent(firstPage.body.data.nextCursor as string)}`,
      )
      .set(authorization(moderator))
      .expect(200);
    expect(secondPage.body.data.items).toHaveLength(1);
    expect(secondPage.body.data.items[0].priority).toBe('NORMAL');
    expect(secondPage.body.data.nextCursor).toBeNull();

    const mine = await request(app)
      .get('/api/v1/moderation/cases?state=IN_REVIEW&priority=HIGH&assignment=MINE')
      .set(authorization(moderator))
      .expect(200);
    expect(mine.body.data.items).toHaveLength(1);
    expect(mine.body.data.items[0].assignment).toEqual({ state: 'ASSIGNED_TO_ME' });
    expect(JSON.stringify(mine.body)).not.toMatch(/assignedModeratorId|reporterId|privateLocation/);
  });

  it('returns safe case, incident, evidence, and aggregate flag detail', async () => {
    const moderator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedCase(reporter.id, { priority: 'HIGH' });
    const evaluatedAt = new Date('2026-08-26T09:00:00.000Z');
    await IncidentEvidenceSnapshotModel.create({
      incidentId: new Types.ObjectId(seeded.incidentId),
      algorithmVersion: 'COMMUNITY_EVIDENCE_V1',
      activeCounts: { support: 2, resolved: 0, dispute: 1, unsure: 1 },
      contributingCounts: { support: 2, resolved: 0, dispute: 1 },
      weightedScores: { support: 2, resolved: 0, dispute: 1 },
      contributingFeedbackCount: 3,
      communityState: 'CONFLICTED',
      supportCount: 2,
      evidenceRevision: 4,
      evaluatedAt,
      nextEvaluationAt: null,
    });

    const response = await request(app)
      .get(`/api/v1/moderation/cases/${seeded.caseId}`)
      .set(authorization(moderator))
      .expect(200);
    const detail = response.body.data.case;
    expect(detail).toMatchObject({
      id: seeded.caseId,
      state: 'QUEUED',
      priority: 'HIGH',
      caseRevision: 0,
      assignment: { state: 'UNASSIGNED' },
      incident: {
        id: seeded.incidentId,
        category: 'HARASSMENT',
        severity: 'HIGH',
        lifecycleRevision: 1,
      },
      communityEvidence: {
        communityState: 'CONFLICTED',
        supportCount: 2,
        activeFeedbackCount: 4,
        evidenceRevision: 4,
        evaluatedAt: evaluatedAt.toISOString(),
      },
      flags: { total: 1, byReason: { SPAM: 1 } },
    });
    expect(Object.keys(detail.communityEvidence).sort()).toEqual(
      ['communityState', 'supportCount', 'activeFeedbackCount', 'evidenceRevision', 'evaluatedAt'].sort(),
    );
    expect(JSON.stringify(detail)).not.toMatch(
      /reporterId|actorId|clientFlagId|privateLocation|publicLocation|coordinates|evidenceWeight|weightedScores|activeCounts|rawFeedback/,
    );
  });

  it('claims an unassigned queued case with dual revision protection and idempotency', async () => {
    const moderator = await createModerator();
    const otherModerator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedCase(reporter.id);
    const clientActionId = randomUUID();
    const body = {
      clientActionId,
      expectedCaseRevision: seeded.caseRevision,
      expectedLifecycleRevision: seeded.lifecycleRevision,
    };

    const claimed = await request(app)
      .post(`/api/v1/moderation/cases/${seeded.caseId}/claim`)
      .set(authorization(moderator))
      .send(body)
      .expect(200);
    expect(claimed.body.data.case).toMatchObject({
      state: 'IN_REVIEW',
      assignment: { state: 'ASSIGNED_TO_ME' },
      caseRevision: 1,
      incident: { moderationState: 'IN_REVIEW', lifecycleRevision: 2 },
    });

    await request(app)
      .post(`/api/v1/moderation/cases/${seeded.caseId}/claim`)
      .set(authorization(moderator))
      .send(body)
      .expect(200);
    expect(await ModerationAuditLogModel.countDocuments({ action: 'CASE_CLAIMED' })).toBe(1);

    const idempotencyConflict = await request(app)
      .post(`/api/v1/moderation/cases/${seeded.caseId}/claim`)
      .set(authorization(moderator))
      .send({ ...body, expectedCaseRevision: 1, expectedLifecycleRevision: 2 })
      .expect(409);
    expect(idempotencyConflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const unavailable = await request(app)
      .post(`/api/v1/moderation/cases/${seeded.caseId}/claim`)
      .set(authorization(otherModerator))
      .send({
        clientActionId: randomUUID(),
        expectedCaseRevision: 1,
        expectedLifecycleRevision: 2,
      })
      .expect(409);
    expect(unavailable.body.error.code).toBe('MODERATION_CASE_STATE_CONFLICT');
  });

  it('rejects stale case or lifecycle revisions without mutating workflow state', async () => {
    const moderator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedCase(reporter.id);

    for (const body of [
      {
        clientActionId: randomUUID(),
        expectedCaseRevision: 1,
        expectedLifecycleRevision: seeded.lifecycleRevision,
      },
      {
        clientActionId: randomUUID(),
        expectedCaseRevision: seeded.caseRevision,
        expectedLifecycleRevision: 2,
      },
    ]) {
      const response = await request(app)
        .post(`/api/v1/moderation/cases/${seeded.caseId}/claim`)
        .set(authorization(moderator))
        .send(body)
        .expect(409);
      expect(response.body.error.code).toBe('MODERATION_REVISION_CONFLICT');
    }
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
    expect(await ModerationCaseModel.findById(seeded.caseId).lean().exec()).toMatchObject({
      state: 'QUEUED',
      caseRevision: 0,
    });
  });

  it('allows only the assigned moderator to release a case and records the reason', async () => {
    const moderator = await createModerator();
    const otherModerator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedCase(reporter.id, {
      state: 'IN_REVIEW',
      assignedModeratorId: moderator.id,
    });
    const body = {
      clientActionId: randomUUID(),
      expectedCaseRevision: 0,
      expectedLifecycleRevision: 2,
      reason: '  Returning to the queue for reassignment.  ',
    };

    const denied = await request(app)
      .post(`/api/v1/moderation/cases/${seeded.caseId}/release`)
      .set(authorization(otherModerator))
      .send(body)
      .expect(403);
    expect(denied.body.error.code).toBe('MODERATION_CASE_ASSIGNMENT_REQUIRED');

    const released = await request(app)
      .post(`/api/v1/moderation/cases/${seeded.caseId}/release`)
      .set(authorization(moderator))
      .send(body)
      .expect(200);
    expect(released.body.data.case).toMatchObject({
      state: 'QUEUED',
      assignment: { state: 'UNASSIGNED' },
      caseRevision: 1,
      incident: { visibilityState: 'PUBLIC', moderationState: 'QUEUED', lifecycleRevision: 3 },
    });
    const audit = await ModerationAuditLogModel.findOne({ action: 'CASE_RELEASED' })
      .select('+moderatorId +clientActionId +reason')
      .exec();
    expect(audit?.moderatorId?.toString()).toBe(moderator.id);
    expect(audit?.reason).toBe('Returning to the queue for reassignment.');
  });

  it('reopens a resolved case without changing hidden incident visibility', async () => {
    const moderator = await createModerator();
    const previousModerator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedCase(reporter.id, {
      state: 'RESOLVED',
      assignedModeratorId: previousModerator.id,
      hidden: true,
    });

    const reopened = await request(app)
      .post(`/api/v1/moderation/cases/${seeded.caseId}/reopen`)
      .set(authorization(moderator))
      .send({
        clientActionId: randomUUID(),
        expectedCaseRevision: 0,
        expectedLifecycleRevision: 3,
        reason: 'New context requires another review.',
      })
      .expect(200);
    expect(reopened.body.data.case).toMatchObject({
      state: 'QUEUED',
      assignment: { state: 'UNASSIGNED' },
      caseRevision: 1,
      incident: {
        visibilityState: 'HIDDEN',
        moderationState: 'QUEUED',
        lifecycleRevision: 4,
        status: 'REJECTED',
      },
    });

    const stored = await ModerationCaseModel.findById(seeded.caseId)
      .select('+assignedModeratorId +resolutionReason')
      .exec();
    expect(stored).toMatchObject({
      state: 'QUEUED',
      assignedModeratorId: null,
      resolution: null,
      resolutionReason: null,
      resolvedAt: null,
    });
    expect(await ModerationAuditLogModel.countDocuments({ action: 'CASE_REOPENED' })).toBe(1);
  });

  it('strictly validates workflow action bodies', async () => {
    const moderator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedCase(reporter.id);

    for (const body of [
      {
        clientActionId: 'not-a-uuid',
        expectedCaseRevision: 0,
        expectedLifecycleRevision: 1,
      },
      {
        clientActionId: randomUUID(),
        expectedCaseRevision: -1,
        expectedLifecycleRevision: 1,
      },
      {
        clientActionId: randomUUID(),
        expectedCaseRevision: 0,
        expectedLifecycleRevision: 1,
        visibilityState: 'HIDDEN',
      },
    ]) {
      await request(app)
        .post(`/api/v1/moderation/cases/${seeded.caseId}/claim`)
        .set(authorization(moderator))
        .send(body)
        .expect(400);
    }
  });
});
