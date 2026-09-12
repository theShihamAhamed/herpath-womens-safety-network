import { randomUUID } from 'node:crypto';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';
import { SessionModel } from '../../src/modules/auth/session.model.js';
import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';
import { IncidentFlagModel } from '../../src/modules/moderation/incident-flag.model.js';
import { ModerationAuditLogModel } from '../../src/modules/moderation/moderation-audit.model.js';
import { ModerationCaseModel } from '../../src/modules/moderation/moderation-case.model.js';
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

interface TestActor {
  id: string;
  token: string;
}

describe('protected incident flag intake API', () => {
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
    ]);
    app = createApp({ config, logger: silentLogger });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  async function createActor(): Promise<TestActor> {
    const response = await request(app)
      .post('/api/v1/auth/anonymous')
      .set('Content-Length', '0')
      .expect(201);
    return {
      id: response.body.data.user.id as string,
      token: response.body.data.accessToken as string,
    };
  }

  async function createIncident(reporterId: string): Promise<string> {
    const incident = await incidents.create({
      reporterId,
      clientSubmissionId: randomUUID(),
      category: 'HARASSMENT',
      severity: 'HIGH',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      location: {
        mode: 'EXACT_PRIVATE',
        privateLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
      },
    });
    return incident._id.toString();
  }

  function endpoint(incidentId: string): string {
    return `/api/v1/incidents/${incidentId}/flags`;
  }

  function authorization(actor: TestActor): Record<string, string> {
    return { Authorization: `Bearer ${actor.token}` };
  }

  it('requires authentication and strictly rejects client-controlled fields', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentId = await createIncident(reporter.id);

    await request(app)
      .post(endpoint(incidentId))
      .send({ clientFlagId: randomUUID(), reason: 'SPAM' })
      .expect(401);

    for (const injected of [
      { actorId: actor.id },
      { createdAt: new Date().toISOString() },
      { priority: 'URGENT' },
      { visibilityState: 'HIDDEN' },
      { communityState: 'CONFLICTED' },
      { moderationState: 'RESOLVED' },
      { lifecycleRevision: 10 },
    ]) {
      const response = await request(app)
        .post(endpoint(incidentId))
        .set(authorization(actor))
        .send({ clientFlagId: randomUUID(), reason: 'SPAM', ...injected })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await IncidentFlagModel.countDocuments()).toBe(0);
  });

  it('creates an actor-safe flag, moderation case, queue lifecycle, and system audit', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentId = await createIncident(reporter.id);
    const clientFlagId = randomUUID().toUpperCase();

    const response = await request(app)
      .post(endpoint(incidentId))
      .set(authorization(actor))
      .send({
        clientFlagId,
        reason: 'PRIVACY_VIOLATION',
        details: '  Potential identifying information  ',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        flag: {
          incidentId,
          reason: 'PRIVACY_VIOLATION',
          details: 'Potential identifying information',
        },
      },
      meta: {},
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(
      /actorId|clientFlagId|reporterId|priority|visibilityState|communityState|moderationState|lifecycleRevision/,
    );

    const [storedFlag, storedCase, storedIncident, audit] = await Promise.all([
      IncidentFlagModel.findOne().select('+actorId +clientFlagId +details').exec(),
      ModerationCaseModel.findOne().exec(),
      IncidentModel.findById(incidentId).exec(),
      ModerationAuditLogModel.findOne().exec(),
    ]);
    expect(storedFlag).toMatchObject({ reason: 'PRIVACY_VIOLATION' });
    expect(storedFlag?.actorId.toString()).toBe(actor.id);
    expect(storedFlag?.clientFlagId).toBe(clientFlagId.toLowerCase());
    expect(storedCase).toMatchObject({
      state: 'QUEUED',
      priority: 'URGENT',
      priorityRank: 3,
      flagCount: 1,
      caseRevision: 0,
    });
    expect(storedCase?.reasonCounts.PRIVACY_VIOLATION).toBe(1);
    expect(storedIncident).toMatchObject({
      visibilityState: 'PUBLIC',
      moderationState: 'QUEUED',
      lifecycleRevision: 1,
    });
    expect(audit).toMatchObject({ actorType: 'SYSTEM', action: 'CASE_QUEUED' });
  });

  it('rejects reporter self-flagging', async () => {
    const reporter = await createActor();
    const incidentId = await createIncident(reporter.id);
    const response = await request(app)
      .post(endpoint(incidentId))
      .set(authorization(reporter))
      .send({ clientFlagId: randomUUID(), reason: 'INACCURATE' })
      .expect(403);

    expect(response.body.error.code).toBe('SELF_FLAG_NOT_ALLOWED');
    expect(await IncidentFlagModel.countDocuments()).toBe(0);
  });

  it('uses indistinguishable 404 responses for missing, hidden, and archived incidents', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const hiddenId = await createIncident(reporter.id);
    const archivedId = await createIncident(reporter.id);
    await IncidentModel.updateOne(
      { _id: hiddenId },
      { $set: { visibilityState: 'HIDDEN', status: 'REJECTED', lifecycleRevision: 1 } },
    );
    await IncidentModel.updateOne(
      { _id: archivedId },
      { $set: { visibilityState: 'ARCHIVED', status: 'ARCHIVED', lifecycleRevision: 1 } },
    );

    const responses = [];
    for (const incidentId of [new mongoose.Types.ObjectId().toString(), hiddenId, archivedId]) {
      responses.push(
        await request(app)
          .post(endpoint(incidentId))
          .set(authorization(actor))
          .send({ clientFlagId: randomUUID(), reason: 'SPAM' })
          .expect(404),
      );
    }

    expect(responses.map((response) => response.body.error)).toEqual([
      responses[0]!.body.error,
      responses[0]!.body.error,
      responses[0]!.body.error,
    ]);
    expect(responses[0]!.body.error.code).toBe('INCIDENT_NOT_AVAILABLE');
    expect(await IncidentFlagModel.countDocuments()).toBe(0);
  });

  it('returns exact replays and rejects changed idempotency intent', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentId = await createIncident(reporter.id);
    const clientFlagId = randomUUID();
    const body = { clientFlagId, reason: 'MISLEADING', details: 'Incorrect context' };

    const created = await request(app)
      .post(endpoint(incidentId))
      .set(authorization(actor))
      .send(body)
      .expect(201);
    const replay = await request(app)
      .post(endpoint(incidentId))
      .set(authorization(actor))
      .send(body)
      .expect(200);
    expect(replay.body.data.flag).toEqual(created.body.data.flag);

    const conflict = await request(app)
      .post(endpoint(incidentId))
      .set(authorization(actor))
      .send({ ...body, reason: 'SPAM' })
      .expect(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await IncidentFlagModel.countDocuments()).toBe(1);
    expect(await ModerationCaseModel.countDocuments()).toBe(1);
  });

  it('rejects a second UUID from the same actor for the same incident', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentId = await createIncident(reporter.id);

    await request(app)
      .post(endpoint(incidentId))
      .set(authorization(actor))
      .send({ clientFlagId: randomUUID(), reason: 'SPAM' })
      .expect(201);
    const duplicate = await request(app)
      .post(endpoint(incidentId))
      .set(authorization(actor))
      .send({ clientFlagId: randomUUID(), reason: 'INACCURATE' })
      .expect(409);

    expect(duplicate.body.error.code).toBe('FLAG_ALREADY_SUBMITTED');
    expect(await IncidentFlagModel.countDocuments()).toBe(1);
  });

  it('preserves an active moderation review when another actor flags the incident', async () => {
    const reporter = await createActor();
    const firstActor = await createActor();
    const secondActor = await createActor();
    const moderator = await createActor();
    const incidentId = await createIncident(reporter.id);

    await request(app)
      .post(endpoint(incidentId))
      .set(authorization(firstActor))
      .send({ clientFlagId: randomUUID(), reason: 'SPAM' })
      .expect(201);
    await ModerationCaseModel.collection.updateOne(
      { incidentId: new mongoose.Types.ObjectId(incidentId) },
      {
        $set: {
          state: 'IN_REVIEW',
          assignedModeratorId: new mongoose.Types.ObjectId(moderator.id),
          reviewStartedAt: new Date('2026-08-26T10:00:00.000Z'),
        },
      },
    );
    await IncidentModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(incidentId) },
      { $set: { moderationState: 'IN_REVIEW', lifecycleRevision: 2 } },
    );

    await request(app)
      .post(endpoint(incidentId))
      .set(authorization(secondActor))
      .send({ clientFlagId: randomUUID(), reason: 'INACCURATE' })
      .expect(201);

    const [moderationCase, incident] = await Promise.all([
      ModerationCaseModel.findOne()
        .select('+assignedModeratorId +resolutionReason')
        .exec(),
      IncidentModel.findById(incidentId).exec(),
    ]);
    expect(moderationCase).toMatchObject({
      state: 'IN_REVIEW',
      priority: 'NORMAL',
      flagCount: 2,
      caseRevision: 1,
    });
    expect(moderationCase?.assignedModeratorId?.toString()).toBe(moderator.id);
    expect(incident).toMatchObject({
      visibilityState: 'PUBLIC',
      moderationState: 'IN_REVIEW',
      lifecycleRevision: 2,
    });
  });

  it('counts only new flags toward the five-per-actor window', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentIds = await Promise.all(
      Array.from({ length: 6 }, () => createIncident(reporter.id)),
    );
    const firstId = randomUUID();

    await request(app)
      .post(endpoint(incidentIds[0]!))
      .set(authorization(actor))
      .send({ clientFlagId: firstId, reason: 'SPAM' })
      .expect(201);
    await request(app)
      .post(endpoint(incidentIds[0]!))
      .set(authorization(actor))
      .send({ clientFlagId: firstId, reason: 'SPAM' })
      .expect(200);

    for (const incidentId of incidentIds.slice(1, 5)) {
      await request(app)
        .post(endpoint(incidentId))
        .set(authorization(actor))
        .send({ clientFlagId: randomUUID(), reason: 'SPAM' })
        .expect(201);
    }

    const duplicateBeforeQuota = await request(app)
      .post(endpoint(incidentIds[0]!))
      .set(authorization(actor))
      .send({ clientFlagId: randomUUID(), reason: 'INACCURATE' })
      .expect(409);
    expect(duplicateBeforeQuota.body.error.code).toBe('FLAG_ALREADY_SUBMITTED');

    const conflictBeforeQuota = await request(app)
      .post(endpoint(incidentIds[0]!))
      .set(authorization(actor))
      .send({ clientFlagId: firstId, reason: 'INACCURATE' })
      .expect(409);
    expect(conflictBeforeQuota.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const limited = await request(app)
      .post(endpoint(incidentIds[5]!))
      .set(authorization(actor))
      .send({ clientFlagId: randomUUID(), reason: 'SPAM' })
      .expect(429);
    expect(limited.body.error.code).toBe('FLAG_RATE_LIMIT_EXCEEDED');
    expect(await IncidentFlagModel.countDocuments()).toBe(5);
  });

  it('aggregates concurrent flags into one moderation case', async () => {
    const reporter = await createActor();
    const actors = await Promise.all([createActor(), createActor()]);
    const incidentId = await createIncident(reporter.id);

    const responses = await Promise.all(
      actors.map((actor, index) =>
        request(app)
          .post(endpoint(incidentId))
          .set(authorization(actor))
          .send({
            clientFlagId: randomUUID(),
            reason: index === 0 ? 'SPAM' : 'HARMFUL_CONTENT',
          }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(await IncidentFlagModel.countDocuments()).toBe(2);
    expect(await ModerationCaseModel.countDocuments()).toBe(1);

    const moderationCase = await ModerationCaseModel.findOne().exec();
    expect(moderationCase).toMatchObject({
      state: 'QUEUED',
      priority: 'HIGH',
      priorityRank: 2,
      flagCount: 2,
      caseRevision: 1,
    });
    expect(moderationCase?.reasonCounts.SPAM).toBe(1);
    expect(moderationCase?.reasonCounts.HARMFUL_CONTENT).toBe(1);
  });
});
