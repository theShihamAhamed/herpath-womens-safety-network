import mongoose, { type ClientSession } from 'mongoose';

import { AppError } from '../../common/errors/app-error.js';
import { planIncidentLifecycleTransition } from '../incidents/incident-lifecycle.service.js';
import type { IncidentDocument } from '../incidents/incident.model.js';
import { IncidentRepository } from '../incidents/incident.repository.js';
import type { IncidentLifecycleAuditSnapshot } from './moderation.types.js';
import {
  IncidentFlagRateLimitError,
  IncidentFlagRateLimiter,
  type IncidentFlagRateLimitOptions,
} from './moderation.rate-limiter.js';
import type { IncidentFlagDocument } from './incident-flag.model.js';
import type { ModerationCaseDocument } from './moderation-case.model.js';
import { ModerationRepository } from './moderation.repository.js';
import {
  INCIDENT_FLAG_REASONS,
  MODERATION_PRIORITY_RANKS,
  type IncidentFlagReason,
  type IncidentFlagReasonCounts,
  type ModerationAuditAction,
  type ModerationPriority,
} from './moderation.types.js';
import type { SubmitIncidentFlagInput } from './moderation.validation.js';

export interface IncidentFlagProjection {
  id: string;
  incidentId: string;
  reason: IncidentFlagReason;
  details?: string;
  submittedAt: string;
}

export interface SubmitIncidentFlagResult {
  flag: IncidentFlagProjection;
  created: boolean;
}

interface FlagIntent {
  incidentId: string;
  reason: IncidentFlagReason;
  details: string | null;
}

interface CaseIntakeResult {
  moderationCase: ModerationCaseDocument;
  previousCase: ModerationCaseDocument | null;
  auditAction: ModerationAuditAction | null;
}

function unavailableIncident(): AppError {
  return new AppError({
    statusCode: 404,
    code: 'INCIDENT_NOT_AVAILABLE',
    message: 'The incident is not available for flagging.',
  });
}

function selfFlagError(): AppError {
  return new AppError({
    statusCode: 403,
    code: 'SELF_FLAG_NOT_ALLOWED',
    message: 'Reporters cannot flag their own incident.',
  });
}

function idempotencyConflict(): AppError {
  return new AppError({
    statusCode: 409,
    code: 'IDEMPOTENCY_CONFLICT',
    message: 'This flag identifier was already used for different flag content.',
  });
}

function flagAlreadySubmitted(): AppError {
  return new AppError({
    statusCode: 409,
    code: 'FLAG_ALREADY_SUBMITTED',
    message: 'You have already flagged this incident.',
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function toProjection(flag: IncidentFlagDocument): IncidentFlagProjection {
  return {
    id: flag._id.toString(),
    incidentId: flag.incidentId.toString(),
    reason: flag.reason,
    ...(flag.details === undefined ? {} : { details: flag.details }),
    submittedAt: flag.createdAt.toISOString(),
  };
}

function intentFromInput(incidentId: string, input: SubmitIncidentFlagInput): FlagIntent {
  return {
    incidentId,
    reason: input.reason,
    details: input.details ?? null,
  };
}

function intentFromDocument(flag: IncidentFlagDocument): FlagIntent {
  return {
    incidentId: flag.incidentId.toString(),
    reason: flag.reason,
    details: flag.details ?? null,
  };
}

function intentsMatch(left: FlagIntent, right: FlagIntent): boolean {
  return (
    left.incidentId === right.incidentId &&
    left.reason === right.reason &&
    left.details === right.details
  );
}

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

function copyReasonCounts(moderationCase: ModerationCaseDocument): IncidentFlagReasonCounts {
  const counts = emptyReasonCounts();
  for (const reason of INCIDENT_FLAG_REASONS) {
    counts[reason] = moderationCase.reasonCounts[reason];
  }
  return counts;
}

function priorityForReason(reason: IncidentFlagReason): ModerationPriority {
  if (reason === 'PRIVACY_VIOLATION') return 'URGENT';
  if (reason === 'HARMFUL_CONTENT') return 'HIGH';
  return 'NORMAL';
}

function higherPriority(
  current: ModerationPriority,
  candidate: ModerationPriority,
): ModerationPriority {
  return MODERATION_PRIORITY_RANKS[candidate] > MODERATION_PRIORITY_RANKS[current]
    ? candidate
    : current;
}

function lifecycleSnapshot(incident: IncidentDocument): IncidentLifecycleAuditSnapshot {
  return {
    visibilityState: incident.visibilityState,
    communityState: incident.communityState,
    moderationState: incident.moderationState,
    lifecycleRevision: incident.lifecycleRevision,
    status: incident.status,
  };
}

export class ModerationService {
  private readonly now: () => Date;

  public constructor(
    private readonly moderation: ModerationRepository,
    private readonly incidents: IncidentRepository,
    private readonly limiter: IncidentFlagRateLimiter,
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  public async submitFlag(
    actorId: string,
    incidentId: string,
    input: SubmitIncidentFlagInput,
  ): Promise<SubmitIncidentFlagResult> {
    const intendedFlag = intentFromInput(incidentId, input);
    const initialReplay = await this.moderation.findFlagByIdempotencyKey(
      actorId,
      input.clientFlagId,
    );
    if (initialReplay) return this.resolveExisting(initialReplay, intendedFlag);

    let quotaReserved = false;

    try {
      return await mongoose.connection.transaction(async (session) => {
        const replay = await this.moderation.findFlagByIdempotencyKey(
          actorId,
          input.clientFlagId,
          session,
        );
        if (replay) return this.resolveExisting(replay, intendedFlag);

        const incident = await this.incidents.findModerationFlagTarget(incidentId, session);
        if (!incident || incident.visibilityState !== 'PUBLIC') throw unavailableIncident();
        if (incident.reporterId.toString() === actorId) throw selfFlagError();

        const existingActorFlag = await this.moderation.findFlagForActorIncident(
          incidentId,
          actorId,
          session,
        );
        if (existingActorFlag) throw flagAlreadySubmitted();

        try {
          quotaReserved = this.limiter.reserve(actorId, input.clientFlagId) || quotaReserved;
        } catch (error) {
          if (error instanceof IncidentFlagRateLimitError) {
            throw new AppError({
              statusCode: 429,
              code: 'FLAG_RATE_LIMIT_EXCEEDED',
              message: error.message,
              cause: error,
            });
          }
          throw error;
        }

        const flag = await this.moderation.createFlag(
          {
            actorId,
            incidentId,
            clientFlagId: input.clientFlagId,
            reason: input.reason,
            ...(input.details === undefined ? {} : { details: input.details }),
          },
          session,
        );
        await this.applyCaseIntake(incident, flag, session);
        return { flag: toProjection(flag), created: true };
      });
    } catch (error) {
      const committedReplay = await this.moderation.findFlagByIdempotencyKey(
        actorId,
        input.clientFlagId,
      );
      if (committedReplay) return this.resolveExisting(committedReplay, intendedFlag);

      if (quotaReserved) this.limiter.release(actorId, input.clientFlagId);

      if (isDuplicateKeyError(error)) {
        const existingActorFlag = await this.moderation.findFlagForActorIncident(
          incidentId,
          actorId,
        );
        if (existingActorFlag) throw flagAlreadySubmitted();
      }
      throw error;
    }
  }

  private resolveExisting(
    flag: IncidentFlagDocument,
    intendedFlag: FlagIntent,
  ): SubmitIncidentFlagResult {
    if (!intentsMatch(intentFromDocument(flag), intendedFlag)) throw idempotencyConflict();
    return { flag: toProjection(flag), created: false };
  }

  private async applyCaseIntake(
    incident: IncidentDocument,
    flag: IncidentFlagDocument,
    session: ClientSession,
  ): Promise<void> {
    const previousLifecycle = lifecycleSnapshot(incident);
    const intake = await this.createOrUpdateCase(flag, session);
    const nextLifecycle = await this.queueIncidentForCase(
      incident,
      intake.moderationCase.state,
      session,
    );

    if (intake.auditAction === null) return;

    await this.moderation.createAuditLog(
      {
        caseId: intake.moderationCase._id.toString(),
        incidentId: incident._id.toString(),
        actorType: 'SYSTEM',
        action: intake.auditAction,
        reason:
          intake.auditAction === 'CASE_REOPENED'
            ? 'A new incident flag reopened the moderation case.'
            : intake.auditAction === 'CASE_PRIORITY_CHANGED'
              ? 'A new incident flag increased the moderation case priority.'
              : 'An incident flag queued a moderation case.',
        previousCaseState:
          intake.previousCase === null
            ? null
            : {
                state: intake.previousCase.state,
                priority: intake.previousCase.priority,
                caseRevision: intake.previousCase.caseRevision,
              },
        newCaseState: {
          state: intake.moderationCase.state,
          priority: intake.moderationCase.priority,
          caseRevision: intake.moderationCase.caseRevision,
        },
        previousIncidentLifecycle: previousLifecycle,
        newIncidentLifecycle: nextLifecycle,
        triggerFlagId: flag._id.toString(),
      },
      session,
    );
  }

  private async createOrUpdateCase(
    flag: IncidentFlagDocument,
    session: ClientSession,
  ): Promise<CaseIntakeResult> {
    const incidentId = flag.incidentId.toString();
    const existing = await this.moderation.findCaseByIncident(incidentId, session);
    const evaluatedAt = this.now();
    const flagPriority = priorityForReason(flag.reason);

    if (!existing) {
      const reasonCounts = emptyReasonCounts();
      reasonCounts[flag.reason] = 1;
      const created = await this.moderation.createCase(
        {
          incidentId,
          sources: ['USER_FLAG'],
          priority: flagPriority,
          flagCount: 1,
          reasonCounts,
          queuedAt: evaluatedAt,
          latestActivityAt: evaluatedAt,
        },
        session,
      );
      return { moderationCase: created, previousCase: null, auditAction: 'CASE_QUEUED' };
    }

    const reasonCounts = copyReasonCounts(existing);
    reasonCounts[flag.reason] += 1;
    const priority = higherPriority(existing.priority, flagPriority);
    const reopening = existing.state === 'RESOLVED';
    const updated = await this.moderation.updateCaseWithRevision(
      existing._id.toString(),
      existing.caseRevision,
      {
        sources: existing.sources.includes('USER_FLAG')
          ? [...existing.sources]
          : [...existing.sources, 'USER_FLAG'],
        state: reopening ? 'QUEUED' : existing.state,
        priority,
        assignedModeratorId:
          reopening || existing.assignedModeratorId === null
            ? null
            : existing.assignedModeratorId.toString(),
        flagCount: existing.flagCount + 1,
        reasonCounts,
        resolution: reopening ? null : existing.resolution,
        resolutionReason: reopening ? null : existing.resolutionReason,
        relatedIncidentId:
          reopening || existing.relatedIncidentId === null
            ? null
            : existing.relatedIncidentId.toString(),
        queuedAt: reopening ? evaluatedAt : existing.queuedAt,
        reviewStartedAt: reopening ? null : existing.reviewStartedAt,
        resolvedAt: reopening ? null : existing.resolvedAt,
        latestActivityAt: evaluatedAt,
      },
      session,
    );
    if (!updated) throw new Error('Moderation case revision changed during flag intake');

    return {
      moderationCase: updated,
      previousCase: existing,
      auditAction: reopening
        ? 'CASE_REOPENED'
        : priority !== existing.priority
          ? 'CASE_PRIORITY_CHANGED'
          : null,
    };
  }

  private async queueIncidentForCase(
    incident: IncidentDocument,
    caseState: ModerationCaseDocument['state'],
    session: ClientSession,
  ): Promise<IncidentLifecycleAuditSnapshot> {
    const shouldQueue = caseState === 'QUEUED';
    const action =
      shouldQueue && incident.moderationState === 'NOT_QUEUED'
        ? ({ type: 'QUEUE' } as const)
        : shouldQueue && incident.moderationState === 'RESOLVED'
          ? ({ type: 'REOPEN_REVIEW' } as const)
          : null;
    if (action === null) return lifecycleSnapshot(incident);

    const transition = planIncidentLifecycleTransition(
      {
        visibilityState: incident.visibilityState,
        communityState: incident.communityState,
        moderationState: incident.moderationState,
        lifecycleRevision: incident.lifecycleRevision,
      },
      action,
    );
    await this.incidents.saveModerationQueueState(
      incident,
      {
        moderationState: transition.next.moderationState,
        status: transition.legacyStatus,
        lifecycleRevision: transition.next.lifecycleRevision,
      },
      session,
    );
    return lifecycleSnapshot(incident);
  }
}

export function createModerationService(
  options: IncidentFlagRateLimitOptions,
): ModerationService {
  return new ModerationService(
    new ModerationRepository(),
    new IncidentRepository(),
    new IncidentFlagRateLimiter(options),
  );
}
