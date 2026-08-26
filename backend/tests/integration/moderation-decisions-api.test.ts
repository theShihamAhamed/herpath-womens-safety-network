import { randomUUID } from 'node:crypto';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
  ModerationDecisionAction,
  ModerationResolution,
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

interface SeededReview {
  caseId: string;
  incidentId: string;
}

function reasonCounts(): IncidentFlagReasonCounts {
  return {
    INACCURATE: 1,
    SPAM: 0,
    DUPLICATE: 0,
    HARMFUL_CONTENT: 0,
    PRIVACY_VIOLATION: 0,
    MISLEADING: 0,
    OTHER: 0,
  };
}

describe('audited incident lifecycle decision API', () => {
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
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
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
      .send({ name: 'Decision Moderator', email, password })
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

  function endpoint(caseId: string): string {
    return `/api/v1/moderation/cases/${caseId}/decision`;
  }

  async function createIncident(reporterId: string): Promise<string> {
    const incident = await incidents.create({
      reporterId,
      clientSubmissionId: randomUUID(),
      category: 'HARASSMENT',
      severity: 'HIGH',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      description: 'Incident details for assigned moderator review',
      location: {
        mode: 'EXACT_PRIVATE',
        privateLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
      },
    });
    return incident._id.toString();
  }

  async function seedReview(
    reporterId: string,
    moderatorId: string,
    visibilityState: 'PUBLIC' | 'HIDDEN' | 'ARCHIVED' = 'PUBLIC',
  ): Promise<SeededReview> {
    const incidentId = await createIncident(reporterId);
    const status =
      visibilityState === 'HIDDEN'
        ? 'REJECTED'
        : visibilityState === 'ARCHIVED'
          ? 'ARCHIVED'
          : 'COMMUNITY_SUPPORTED';
    await IncidentModel.collection.updateOne(
      { _id: new Types.ObjectId(incidentId) },
      {
        $set: {
          visibilityState,
          communityState: 'SUPPORTED',
          moderationState: 'IN_REVIEW',
          lifecycleRevision: 2,
          status,
          supportCount: 3,
        },
      },
    );
    const moderationCase = await moderation.createCase({
      incidentId,
      sources: ['USER_FLAG'],
      priority: 'HIGH',
      flagCount: 1,
      reasonCounts: reasonCounts(),
      queuedAt: new Date('2026-08-25T08:00:00.000Z'),
      latestActivityAt: new Date('2026-08-25T09:00:00.000Z'),
    });
    await ModerationCaseModel.collection.updateOne(
      { _id: moderationCase._id },
      {
        $set: {
          state: 'IN_REVIEW',
          assignedModeratorId: new Types.ObjectId(moderatorId),
          reviewStartedAt: new Date('2026-08-25T09:00:00.000Z'),
        },
      },
    );
    return { caseId: moderationCase._id.toString(), incidentId };
  }

  function decisionBody(
    action: ModerationDecisionAction,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      clientActionId: randomUUID(),
      expectedCaseRevision: 0,
      expectedLifecycleRevision: 2,
      action,
      reason: `Reason for ${action}`,
      ...overrides,
    };
  }

  it('requires a moderator and permits only the assigned non-reporter moderator', async () => {
    const reporter = await createUser();
    const user = await createUser();
    const assigned = await createModerator();
    const otherModerator = await createModerator();
    const seeded = await seedReview(reporter.id, assigned.id);

    await request(app).post(endpoint(seeded.caseId)).send(decisionBody('NO_ACTION')).expect(401);
    await request(app)
      .post(endpoint(seeded.caseId))
      .set(authorization(user))
      .send(decisionBody('NO_ACTION'))
      .expect(403);
    const assignmentDenied = await request(app)
      .post(endpoint(seeded.caseId))
      .set(authorization(otherModerator))
      .send(decisionBody('NO_ACTION'))
      .expect(403);
    expect(assignmentDenied.body.error.code).toBe('MODERATION_CASE_ASSIGNMENT_REQUIRED');

    const selfOwned = await seedReview(assigned.id, assigned.id);
    const selfDenied = await request(app)
      .post(endpoint(selfOwned.caseId))
      .set(authorization(assigned))
      .send(decisionBody('NO_ACTION'))
      .expect(403);
    expect(selfDenied.body.error.code).toBe('SELF_MODERATION_NOT_ALLOWED');
  });

  it('applies every decision with one lifecycle revision and an audit record', async () => {
    const moderator = await createModerator();
    const reporter = await createUser();
    const relatedIncidentId = await createIncident(reporter.id);
    const scenarios: Array<{
      action: ModerationDecisionAction;
      initial: 'PUBLIC' | 'HIDDEN' | 'ARCHIVED';
      expectedVisibility: 'PUBLIC' | 'HIDDEN' | 'ARCHIVED';
      expectedResolution: ModerationResolution;
      expectedAudit: string;
      relatedIncidentId?: string;
    }> = [
      {
        action: 'NO_ACTION',
        initial: 'PUBLIC',
        expectedVisibility: 'PUBLIC',
        expectedResolution: 'NO_ACTION',
        expectedAudit: 'DECISION_NO_ACTION',
      },
      {
        action: 'HIDE',
        initial: 'PUBLIC',
        expectedVisibility: 'HIDDEN',
        expectedResolution: 'HIDDEN',
        expectedAudit: 'DECISION_HIDE',
      },
      {
        action: 'RESTORE',
        initial: 'HIDDEN',
        expectedVisibility: 'PUBLIC',
        expectedResolution: 'RESTORED',
        expectedAudit: 'DECISION_RESTORE',
      },
      {
        action: 'RESTORE',
        initial: 'ARCHIVED',
        expectedVisibility: 'PUBLIC',
        expectedResolution: 'RESTORED',
        expectedAudit: 'DECISION_RESTORE',
      },
      {
        action: 'ARCHIVE',
        initial: 'PUBLIC',
        expectedVisibility: 'ARCHIVED',
        expectedResolution: 'ARCHIVED',
        expectedAudit: 'DECISION_ARCHIVE',
      },
      {
        action: 'ARCHIVE_DUPLICATE',
        initial: 'HIDDEN',
        expectedVisibility: 'ARCHIVED',
        expectedResolution: 'ARCHIVED_DUPLICATE',
        expectedAudit: 'DECISION_ARCHIVE_DUPLICATE',
        relatedIncidentId,
      },
    ];

    for (const scenario of scenarios) {
      const seeded = await seedReview(reporter.id, moderator.id, scenario.initial);
      const response = await request(app)
        .post(endpoint(seeded.caseId))
        .set(authorization(moderator))
        .send(
          decisionBody(scenario.action, {
            ...(scenario.relatedIncidentId === undefined
              ? {}
              : { relatedIncidentId: scenario.relatedIncidentId }),
          }),
        )
        .expect(200);
      expect(response.body.data.case).toMatchObject({
        state: 'RESOLVED',
        assignment: { state: 'ASSIGNED_TO_ME' },
        caseRevision: 1,
        resolution: scenario.expectedResolution,
        relatedIncidentId: scenario.relatedIncidentId ?? null,
        incident: {
          visibilityState: scenario.expectedVisibility,
          moderationState: 'RESOLVED',
          communityState: 'SUPPORTED',
          supportCount: 3,
          lifecycleRevision: 3,
        },
      });

      const [storedCase, storedIncident, audit] = await Promise.all([
        ModerationCaseModel.findById(seeded.caseId)
          .select('+assignedModeratorId +resolutionReason')
          .exec(),
        IncidentModel.findById(seeded.incidentId).exec(),
        ModerationAuditLogModel.findOne({ caseId: new Types.ObjectId(seeded.caseId) }).exec(),
      ]);
      expect(storedCase).toMatchObject({
        state: 'RESOLVED',
        resolution: scenario.expectedResolution,
        caseRevision: 1,
      });
      expect(storedIncident).toMatchObject({
        visibilityState: scenario.expectedVisibility,
        moderationState: 'RESOLVED',
        communityState: 'SUPPORTED',
        supportCount: 3,
        lifecycleRevision: 3,
      });
      expect(audit).toMatchObject({ action: scenario.expectedAudit });
      expect(audit?.newIncidentLifecycle.lifecycleRevision).toBe(3);
    }
    expect(await ModerationAuditLogModel.countDocuments()).toBe(scenarios.length);
    expect(await IncidentEvidenceSnapshotModel.countDocuments()).toBe(0);
  });

  it('rejects stale case and lifecycle revisions without creating an audit', async () => {
    const moderator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedReview(reporter.id, moderator.id);

    for (const body of [
      decisionBody('HIDE', { expectedCaseRevision: 1 }),
      decisionBody('HIDE', { expectedLifecycleRevision: 3 }),
    ]) {
      const response = await request(app)
        .post(endpoint(seeded.caseId))
        .set(authorization(moderator))
        .send(body)
        .expect(409);
      expect(response.body.error.code).toBe('MODERATION_REVISION_CONFLICT');
    }
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
  });

  it('returns exact action replays and rejects changed idempotency intent', async () => {
    const moderator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedReview(reporter.id, moderator.id);
    const body = decisionBody('HIDE');

    const decided = await request(app)
      .post(endpoint(seeded.caseId))
      .set(authorization(moderator))
      .send(body)
      .expect(200);
    const replay = await request(app)
      .post(endpoint(seeded.caseId))
      .set(authorization(moderator))
      .send(body)
      .expect(200);
    expect(replay.body.data.case).toEqual(decided.body.data.case);
    expect(await ModerationAuditLogModel.countDocuments()).toBe(1);

    for (const changed of [
      { ...body, reason: 'A different reason' },
      { ...body, action: 'ARCHIVE' },
      { ...body, expectedCaseRevision: 1 },
    ]) {
      const conflict = await request(app)
        .post(endpoint(seeded.caseId))
        .set(authorization(moderator))
        .send(changed)
        .expect(409);
      expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    }
  });

  it('strictly validates decision actions, reasons, and duplicate relationships', async () => {
    const moderator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedReview(reporter.id, moderator.id);

    for (const body of [
      decisionBody('NO_ACTION', { reason: '' }),
      { ...decisionBody('NO_ACTION'), action: 'DELETE' },
      decisionBody('ARCHIVE_DUPLICATE'),
      decisionBody('HIDE', { relatedIncidentId: new Types.ObjectId().toString() }),
    ]) {
      await request(app)
        .post(endpoint(seeded.caseId))
        .set(authorization(moderator))
        .send(body)
        .expect(400);
    }

    for (const relatedIncidentId of [new Types.ObjectId().toString(), seeded.incidentId]) {
      const invalid = await request(app)
        .post(endpoint(seeded.caseId))
        .set(authorization(moderator))
        .send(decisionBody('ARCHIVE_DUPLICATE', { relatedIncidentId }))
        .expect(400);
      expect(invalid.body.error.code).toBe('INVALID_RELATED_INCIDENT');
    }
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
  });

  it('rolls back case and incident changes when audit persistence fails', async () => {
    const moderator = await createModerator();
    const reporter = await createUser();
    const seeded = await seedReview(reporter.id, moderator.id);
    const auditSave = vi
      .spyOn(ModerationAuditLogModel.prototype, 'save')
      .mockRejectedValueOnce(new Error('simulated audit persistence failure'));

    await request(app)
      .post(endpoint(seeded.caseId))
      .set(authorization(moderator))
      .send(decisionBody('HIDE'))
      .expect(500);
    auditSave.mockRestore();

    const [storedCase, storedIncident] = await Promise.all([
      ModerationCaseModel.findById(seeded.caseId)
        .select('+assignedModeratorId +resolutionReason')
        .exec(),
      IncidentModel.findById(seeded.incidentId).exec(),
    ]);
    expect(storedCase).toMatchObject({
      state: 'IN_REVIEW',
      resolution: null,
      caseRevision: 0,
    });
    expect(storedIncident).toMatchObject({
      visibilityState: 'PUBLIC',
      moderationState: 'IN_REVIEW',
      lifecycleRevision: 2,
      status: 'COMMUNITY_SUPPORTED',
    });
    expect(await ModerationAuditLogModel.countDocuments()).toBe(0);
  });
});
