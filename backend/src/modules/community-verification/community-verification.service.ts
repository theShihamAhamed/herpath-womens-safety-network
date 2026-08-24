import mongoose, { type ClientSession } from 'mongoose';

import { AppError } from '../../common/errors/app-error.js';
import type { IncidentDocument } from '../incidents/incident.model.js';
import { IncidentRepository } from '../incidents/incident.repository.js';
import type { FeedbackResponseCounts } from './community-verification.types.js';
import {
  BASELINE_V1_EVIDENCE_POLICY,
  evaluateCommunityEvidence,
  type CommunityEvidenceEvaluationResult,
} from './community-evidence.service.js';
import {
  CommunityVerificationRateLimitError,
  CommunityVerificationRateLimiter,
  type CommunityVerificationRateLimitOptions,
} from './community-verification.rate-limiter.js';
import { CommunityVerificationRepository } from './community-verification.repository.js';
import {
  FeedbackIdempotencyConflictError,
  classifyFeedbackReplay,
  evaluateFeedbackEligibility,
  type FeedbackEligibilityResult,
} from './feedback-eligibility.service.js';
import type { IncidentEvidenceSnapshotDocument } from './incident-evidence-snapshot.model.js';
import type {
  IncidentFeedbackDocument,
} from './incident-feedback.model.js';
import type { SubmitFeedbackInput } from './community-verification.validation.js';

export interface CommunityFeedbackProjection {
  response: IncidentFeedbackDocument['response'];
  submittedAt: string;
  contributesUntil: string;
}

export interface CommunityEvidenceProjection {
  communityState: IncidentDocument['communityState'];
  supportCount: number;
  activeFeedbackCount: number;
  contributingFeedbackCount: number;
  weightedScores: CommunityEvidenceEvaluationResult['weightedScores'];
  evidenceRevision: number;
  evaluatedAt: string;
}

export interface CommunityVerificationStatus {
  evidence: CommunityEvidenceProjection;
  myFeedback: CommunityFeedbackProjection | null;
}

export interface SubmitCommunityFeedbackResult extends CommunityVerificationStatus {
  created: boolean;
}

export interface CommunityEvidenceReconciliationResult {
  dueCount: number;
  reconciledCount: number;
}

function unavailableIncident(): AppError {
  return new AppError({
    statusCode: 404,
    code: 'INCIDENT_NOT_AVAILABLE',
    message: 'The incident is not available for community feedback.',
  });
}

function feedbackProjection(feedback: IncidentFeedbackDocument): CommunityFeedbackProjection {
  return {
    response: feedback.response,
    submittedAt: feedback.createdAt.toISOString(),
    contributesUntil: new Date(
      feedback.createdAt.getTime() + BASELINE_V1_EVIDENCE_POLICY.staleAfterMs,
    ).toISOString(),
  };
}

function activeCounts(feedback: readonly IncidentFeedbackDocument[]): FeedbackResponseCounts {
  const counts: FeedbackResponseCounts = { support: 0, resolved: 0, dispute: 0, unsure: 0 };
  for (const event of feedback) {
    if (event.response === 'SUPPORT') counts.support += 1;
    if (event.response === 'RESOLVED') counts.resolved += 1;
    if (event.response === 'DISPUTE') counts.dispute += 1;
    if (event.response === 'UNSURE') counts.unsure += 1;
  }
  return counts;
}

function eligibilityError(eligibility: FeedbackEligibilityResult): AppError {
  if (eligibility.reason === 'COOLDOWN_ACTIVE') {
    return new AppError({
      statusCode: 409,
      code: 'FEEDBACK_COOLDOWN_ACTIVE',
      message: 'Please wait before changing community feedback again.',
      details:
        eligibility.nextEligibleAt === null
          ? []
          : [{ nextEligibleAt: eligibility.nextEligibleAt.toISOString() }],
    });
  }
  if (eligibility.reason === 'OWN_REPORT') {
    return new AppError({
      statusCode: 403,
      code: 'FEEDBACK_NOT_ELIGIBLE',
      message: 'Reporters cannot provide community feedback on their own incident.',
    });
  }
  return unavailableIncident();
}

export class CommunityVerificationService {
  private readonly now: () => Date;

  public constructor(
    private readonly verification: CommunityVerificationRepository,
    private readonly incidents: IncidentRepository,
    private readonly limiter: CommunityVerificationRateLimiter,
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  public async submit(
    actorId: string,
    incidentId: string,
    input: SubmitFeedbackInput,
  ): Promise<SubmitCommunityFeedbackResult> {
    const existingReplay = await this.verification.findByIdempotencyKey(
      actorId,
      input.clientFeedbackId,
    );

    try {
      if (
        classifyFeedbackReplay(
          existingReplay
            ? {
                clientFeedbackId: existingReplay.clientFeedbackId,
                incidentId: existingReplay.incidentId.toString(),
                response: existingReplay.response,
              }
            : null,
          { incidentId, response: input.response },
        ) === 'REPLAY'
      ) {
        return {
          ...(await this.status(actorId, incidentId)),
          created: false,
        };
      }
    } catch (error) {
      if (error instanceof FeedbackIdempotencyConflictError) {
        throw new AppError({
          statusCode: 409,
          code: 'IDEMPOTENCY_CONFLICT',
          message: error.message,
          cause: error,
        });
      }
      throw error;
    }

    return mongoose.connection.transaction(async (session) => {
      const incident = await this.incidents.findCommunityFeedbackTarget(incidentId, session);
      if (!incident) throw unavailableIncident();
      const active = await this.verification.findActiveForActor(incidentId, actorId, session);

      if (active?.response === input.response) {
        return {
          ...(await this.statusFromDocuments(actorId, incident, active, session)),
          created: false,
        };
      }

      const eligibility = evaluateFeedbackEligibility({
        actorId,
        incident: {
          id: incident._id.toString(),
          reporterId: incident.reporterId.toString(),
          visibilityState: incident.visibilityState,
        },
        latestFeedback:
          active === null
            ? null
            : { response: active.response, state: active.state, updatedAt: active.updatedAt },
        evaluatedAt: this.now(),
      });
      if (!eligibility.canSubmit) throw eligibilityError(eligibility);

      try {
        this.limiter.reserve(actorId, input.clientFeedbackId);
      } catch (error) {
        if (error instanceof CommunityVerificationRateLimitError) {
          throw new AppError({
            statusCode: 429,
            code: 'FEEDBACK_RATE_LIMIT_EXCEEDED',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }

      if (active) {
        active.state = 'SUPERSEDED';
        await this.verification.saveFeedback(active, session);
      }

      const created = await this.verification.createFeedback(
        {
          incidentId,
          actorId,
          clientFeedbackId: input.clientFeedbackId,
          response: input.response,
          ...(active === null ? {} : { supersedesFeedbackId: active._id.toString() }),
        },
        session,
      );
      const status = await this.evaluateAndPersist(incident, created, session);
      return { ...status, created: active === null };
    });
  }

  public async remove(actorId: string, incidentId: string): Promise<CommunityVerificationStatus> {
    return mongoose.connection.transaction(async (session) => {
      const incident = await this.incidents.findCommunityFeedbackTarget(incidentId, session);
      if (!incident) throw unavailableIncident();
      const active = await this.verification.findActiveForActor(incidentId, actorId, session);
      if (!active) return this.statusFromDocuments(actorId, incident, null, session);

      const eligibility = evaluateFeedbackEligibility({
        actorId,
        incident: {
          id: incident._id.toString(),
          reporterId: incident.reporterId.toString(),
          visibilityState: 'PUBLIC',
        },
        latestFeedback: {
          response: active.response,
          state: active.state,
          updatedAt: active.updatedAt,
        },
        evaluatedAt: this.now(),
      });
      if (eligibility.reason === 'COOLDOWN_ACTIVE') throw eligibilityError(eligibility);

      const mutationId = `withdraw:${active._id.toString()}`;
      try {
        this.limiter.reserve(actorId, mutationId);
      } catch (error) {
        if (error instanceof CommunityVerificationRateLimitError) {
          throw new AppError({
            statusCode: 429,
            code: 'FEEDBACK_RATE_LIMIT_EXCEEDED',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }

      active.state = 'WITHDRAWN';
      active.withdrawnAt = this.now();
      await this.verification.saveFeedback(active, session);
      return this.evaluateAndPersist(incident, null, session);
    });
  }

  public async status(actorId: string, incidentId: string): Promise<CommunityVerificationStatus> {
    const incident = await this.incidents.findCommunityFeedbackTarget(incidentId);
    if (!incident || incident.visibilityState !== 'PUBLIC') throw unavailableIncident();
    const active = await this.verification.findActiveForActor(incidentId, actorId);
    return this.statusFromDocuments(actorId, incident, active);
  }

  public async eligibility(actorId: string, incidentId: string): Promise<FeedbackEligibilityResult> {
    const incident = await this.incidents.findCommunityFeedbackTarget(incidentId);
    const latest = await this.verification.findLatestForActor(incidentId, actorId);
    return evaluateFeedbackEligibility({
      actorId,
      incident:
        incident === null
          ? null
          : {
              id: incident._id.toString(),
              reporterId: incident.reporterId.toString(),
              visibilityState: incident.visibilityState,
            },
      latestFeedback:
        latest === null
          ? null
          : { response: latest.response, state: latest.state, updatedAt: latest.updatedAt },
      evaluatedAt: this.now(),
    });
  }

  public async reconcileDueEvidence(
    evaluatedAt: Date,
    limit: number,
    apply: boolean,
  ): Promise<CommunityEvidenceReconciliationResult> {
    const incidentIds = await this.verification.findDueSnapshotIncidentIds(evaluatedAt, limit);
    if (!apply) return { dueCount: incidentIds.length, reconciledCount: 0 };

    let reconciledCount = 0;
    for (const incidentId of incidentIds) {
      const reconciled = await mongoose.connection.transaction(async (session) => {
        const incident = await this.incidents.findCommunityFeedbackTarget(incidentId, session);
        if (!incident) return false;
        await this.evaluateAndPersist(incident, null, session, evaluatedAt);
        return true;
      });
      if (reconciled) reconciledCount += 1;
    }

    return { dueCount: incidentIds.length, reconciledCount };
  }

  private async evaluateAndPersist(
    incident: IncidentDocument,
    currentFeedback: IncidentFeedbackDocument | null,
    session: ClientSession,
    evaluationTimestamp?: Date,
  ): Promise<CommunityVerificationStatus> {
    const feedback = await this.verification.findActiveForIncident(
      incident._id.toString(),
      session,
    );
    const previousSnapshot = await this.verification.findSnapshot(
      incident._id.toString(),
      session,
    );
    const evaluatedAt = evaluationTimestamp ?? this.now();
    const evaluation = evaluateCommunityEvidence({
      feedbackEvents: feedback.map((event) => ({
        feedbackId: event._id.toString(),
        actorId: event.actorId.toString(),
        response: event.response,
        state: event.state,
        weightBasis: event.weightBasis,
        createdAt: event.createdAt,
      })),
      lifecycle: {
        visibilityState: incident.visibilityState,
        communityState: incident.communityState,
        moderationState: incident.moderationState,
        lifecycleRevision: incident.lifecycleRevision,
      },
      evaluatedAt,
      currentEvidenceRevision: previousSnapshot?.evidenceRevision ?? 0,
    });

    await this.incidents.saveCommunityEvidence(
      incident,
      {
        communityState: evaluation.communityState,
        status: evaluation.legacyStatus,
        supportCount: evaluation.supportCount,
        lifecycleRevision: evaluation.lifecycle.lifecycleRevision,
      },
      session,
    );

    const counts = activeCounts(feedback);
    const snapshot = await this.verification.upsertSnapshot(
      {
        incidentId: incident._id.toString(),
        algorithmVersion: 'COMMUNITY_EVIDENCE_V1',
        activeCounts: counts,
        contributingCounts: {
          support: evaluation.weightedScores.support,
          resolved: evaluation.weightedScores.resolved,
          dispute: evaluation.weightedScores.dispute,
        },
        weightedScores: evaluation.weightedScores,
        contributingFeedbackCount: evaluation.contributingFeedbackCount,
        communityState: evaluation.communityState,
        supportCount: evaluation.supportCount,
        evidenceRevision: evaluation.evidenceRevision,
        evaluatedAt,
        nextEvaluationAt: this.nextEvaluationAt(feedback, evaluatedAt),
      },
      session,
    );

    return {
      evidence: this.evidenceProjection(snapshot),
      myFeedback: currentFeedback === null ? null : feedbackProjection(currentFeedback),
    };
  }

  private async statusFromDocuments(
    _actorId: string,
    incident: IncidentDocument,
    active: IncidentFeedbackDocument | null,
    session?: ClientSession,
  ): Promise<CommunityVerificationStatus> {
    if (incident.visibilityState !== 'PUBLIC') throw unavailableIncident();
    const snapshot = await this.verification.findSnapshot(incident._id.toString(), session);
    return {
      evidence:
        snapshot === null
          ? {
              communityState: incident.communityState,
              supportCount: incident.supportCount,
              activeFeedbackCount: 0,
              contributingFeedbackCount: 0,
              weightedScores: { support: 0, resolved: 0, dispute: 0 },
              evidenceRevision: 0,
              evaluatedAt: incident.updatedAt.toISOString(),
            }
          : this.evidenceProjection(snapshot),
      myFeedback: active === null ? null : feedbackProjection(active),
    };
  }

  private evidenceProjection(
    snapshot: IncidentEvidenceSnapshotDocument,
  ): CommunityEvidenceProjection {
    return {
      communityState: snapshot.communityState,
      supportCount: snapshot.supportCount,
      activeFeedbackCount:
        snapshot.activeCounts.support +
        snapshot.activeCounts.resolved +
        snapshot.activeCounts.dispute +
        snapshot.activeCounts.unsure,
      contributingFeedbackCount: snapshot.contributingFeedbackCount,
      weightedScores: {
        support: snapshot.weightedScores.support,
        resolved: snapshot.weightedScores.resolved,
        dispute: snapshot.weightedScores.dispute,
      },
      evidenceRevision: snapshot.evidenceRevision,
      evaluatedAt: snapshot.evaluatedAt.toISOString(),
    };
  }

  private nextEvaluationAt(
    feedback: readonly IncidentFeedbackDocument[],
    evaluatedAt: Date,
  ): Date | null {
    const expirations = feedback
      .filter((event) => event.response !== 'UNSURE')
      .map(
        (event) =>
          new Date(event.createdAt.getTime() + BASELINE_V1_EVIDENCE_POLICY.staleAfterMs),
      )
      .filter((expiration) => expiration.getTime() > evaluatedAt.getTime())
      .sort((left, right) => left.getTime() - right.getTime());
    return expirations[0] ?? null;
  }
}

export function createCommunityVerificationService(
  options: CommunityVerificationRateLimitOptions,
): CommunityVerificationService {
  return new CommunityVerificationService(
    new CommunityVerificationRepository(),
    new IncidentRepository(),
    new CommunityVerificationRateLimiter(options),
  );
}
