import { randomUUID } from 'node:crypto';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type AppRuntimeConfig } from '../../src/app.js';
import { SessionModel } from '../../src/modules/auth/session.model.js';
import { IncidentEvidenceSnapshotModel } from '../../src/modules/community-verification/incident-evidence-snapshot.model.js';
import { IncidentFeedbackModel } from '../../src/modules/community-verification/incident-feedback.model.js';
import { IncidentModel } from '../../src/modules/incidents/incident.model.js';
import { IncidentRepository } from '../../src/modules/incidents/incident.repository.js';
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

describe('authenticated community verification APIs', () => {
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
      IncidentFeedbackModel.syncIndexes(),
      IncidentEvidenceSnapshotModel.syncIndexes(),
    ]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      SessionModel.deleteMany({}),
      IncidentModel.deleteMany({}),
      IncidentFeedbackModel.deleteMany({}),
      IncidentEvidenceSnapshotModel.deleteMany({}),
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

  it('requires authentication and strictly rejects client-controlled fields', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentId = await createIncident(reporter.id);

    await request(app)
      .post(`/api/v1/incidents/${incidentId}/feedback`)
      .send({ clientFeedbackId: randomUUID(), response: 'SUPPORT' })
      .expect(401);

    const response = await request(app)
      .post(`/api/v1/incidents/${incidentId}/feedback`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        clientFeedbackId: randomUUID(),
        response: 'SUPPORT',
        actorId: actor.id,
        evidenceWeight: 100,
        communityState: 'SUPPORTED',
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await IncidentFeedbackModel.countDocuments()).toBe(0);
  });

  it('creates idempotent actor feedback and rejects changed UUID intent', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentId = await createIncident(reporter.id);
    const clientFeedbackId = randomUUID();
    const endpoint = `/api/v1/incidents/${incidentId}/feedback`;

    const created = await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ clientFeedbackId, response: 'SUPPORT' })
      .expect(201);

    expect(created.body.data.feedback.response).toBe('SUPPORT');
    expect(created.body.data.evidence).toMatchObject({
      communityState: 'UNVERIFIED',
      supportCount: 1,
      activeFeedbackCount: 1,
    });

    await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ clientFeedbackId, response: 'SUPPORT' })
      .expect(200);

    const conflict = await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ clientFeedbackId, response: 'DISPUTE' })
      .expect(409);

    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await IncidentFeedbackModel.countDocuments()).toBe(1);
  });

  it('prevents reporter self-feedback and reports eligibility without private data', async () => {
    const reporter = await createActor();
    const incidentId = await createIncident(reporter.id);

    const eligibility = await request(app)
      .get(`/api/v1/incidents/${incidentId}/feedback/eligibility`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .expect(200);
    expect(eligibility.body.data).toMatchObject({ canSubmit: false, reason: 'OWN_REPORT' });

    const response = await request(app)
      .post(`/api/v1/incidents/${incidentId}/feedback`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ clientFeedbackId: randomUUID(), response: 'SUPPORT' })
      .expect(403);
    expect(response.body.error.code).toBe('FEEDBACK_NOT_ELIGIBLE');
  });

  it('updates evidence and the compatibility projection after independent support', async () => {
    const reporter = await createActor();
    const actors = await Promise.all([createActor(), createActor(), createActor()]);
    const incidentId = await createIncident(reporter.id);

    for (const actor of actors) {
      await request(app)
        .post(`/api/v1/incidents/${incidentId}/feedback`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send({ clientFeedbackId: randomUUID(), response: 'SUPPORT' })
        .expect(201);
    }

    const status = await request(app)
      .get(`/api/v1/incidents/${incidentId}/verification`)
      .set('Authorization', `Bearer ${actors[0]!.token}`)
      .expect(200);
    expect(status.body.data.evidence).toMatchObject({
      communityState: 'SUPPORTED',
      supportCount: 3,
      activeFeedbackCount: 3,
      contributingFeedbackCount: 3,
    });
    expect(status.body.data.myFeedback.response).toBe('SUPPORT');

    const stored = await IncidentModel.findById(incidentId).lean().exec();
    expect(stored).toMatchObject({
      visibilityState: 'PUBLIC',
      communityState: 'SUPPORTED',
      moderationState: 'NOT_QUEUED',
      status: 'COMMUNITY_SUPPORTED',
      supportCount: 3,
      lifecycleRevision: 1,
    });

    const serialized = JSON.stringify(status.body);
    expect(serialized).not.toMatch(/actorId|reporterId|clientFeedbackId|evidenceWeight/);
  });

  it('enforces cooldown before replacement or withdrawal and then recalculates removal', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentId = await createIncident(reporter.id);
    const endpoint = `/api/v1/incidents/${incidentId}/feedback`;

    await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ clientFeedbackId: randomUUID(), response: 'SUPPORT' })
      .expect(201);

    const cooldown = await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ clientFeedbackId: randomUUID(), response: 'RESOLVED' })
      .expect(409);
    expect(cooldown.body.error.code).toBe('FEEDBACK_COOLDOWN_ACTIVE');

    await IncidentFeedbackModel.collection.updateOne(
      { incidentId: new mongoose.Types.ObjectId(incidentId), state: 'ACTIVE' },
      { $set: { updatedAt: new Date(Date.now() - 16 * 60 * 1_000) } },
    );

    await request(app)
      .delete(endpoint)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(200);

    const stored = await IncidentModel.findById(incidentId).lean().exec();
    expect(stored).toMatchObject({
      communityState: 'UNVERIFIED',
      status: 'PUBLISHED_UNVERIFIED',
      supportCount: 0,
    });
    expect(await IncidentFeedbackModel.countDocuments({ state: 'WITHDRAWN' })).toBe(1);

    await request(app)
      .delete(endpoint)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(200);
  });

  it('does not expose hidden incidents through status or new feedback', async () => {
    const reporter = await createActor();
    const actor = await createActor();
    const incidentId = await createIncident(reporter.id);
    await IncidentModel.updateOne(
      { _id: incidentId },
      { $set: { visibilityState: 'HIDDEN', status: 'REJECTED', lifecycleRevision: 1 } },
    );

    await request(app)
      .get(`/api/v1/incidents/${incidentId}/verification`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(404);
    await request(app)
      .post(`/api/v1/incidents/${incidentId}/feedback`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ clientFeedbackId: randomUUID(), response: 'SUPPORT' })
      .expect(404);
  });
});
