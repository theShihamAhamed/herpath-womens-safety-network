import mongoose, { type ClientSession } from 'mongoose';

import { planIncidentLifecycleTransition } from '../incidents/incident-lifecycle.service.js';
import type { IncidentDocument } from '../incidents/incident.model.js';
import {
  IncidentRepository,
  type ModerationConflictIntakeCandidate,
} from '../incidents/incident.repository.js';
import { ModerationRepository } from './moderation.repository.js';
import type {
  IncidentFlagReasonCounts,
  IncidentLifecycleAuditSnapshot,
} from './moderation.types.js';

export interface ModerationIntakeReconciliationResult {
  eligibleIncidents: ModerationConflictIntakeCandidate[];
  queuedCount: number;
}

export interface ReconcileModerationIntakeOptions {
  apply: boolean;
  limit?: number;
}

const DEFAULT_RECONCILIATION_LIMIT = 500;

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

function lifecycleSnapshot(incident: IncidentDocument): IncidentLifecycleAuditSnapshot {
  return {
    visibilityState: incident.visibilityState,
    communityState: incident.communityState,
    moderationState: incident.moderationState,
    lifecycleRevision: incident.lifecycleRevision,
    status: incident.status,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export class ModerationIntakeReconciliationService {
  private readonly now: () => Date;

  public constructor(
    private readonly incidents: IncidentRepository,
    private readonly moderation: ModerationRepository,
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  public async reconcile(
    options: ReconcileModerationIntakeOptions,
  ): Promise<ModerationIntakeReconciliationResult> {
    const candidates = await this.incidents.findModerationConflictIntakeCandidates(
      options.limit ?? DEFAULT_RECONCILIATION_LIMIT,
    );
    const eligibleIncidents: ModerationConflictIntakeCandidate[] = [];

    for (const candidate of candidates) {
      const existingCase = await this.moderation.findCaseByIncident(candidate.incidentId);
      if (!existingCase) eligibleIncidents.push(candidate);
    }

    if (!options.apply) return { eligibleIncidents, queuedCount: 0 };

    let queuedCount = 0;
    for (const candidate of eligibleIncidents) {
      if (await this.applyCandidate(candidate.incidentId)) queuedCount += 1;
    }

    return { eligibleIncidents, queuedCount };
  }

  private async applyCandidate(incidentId: string): Promise<boolean> {
    try {
      return await mongoose.connection.transaction(async (session) =>
        this.applyCandidateInTransaction(incidentId, session),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) return false;
      throw error;
    }
  }

  private async applyCandidateInTransaction(
    incidentId: string,
    session: ClientSession,
  ): Promise<boolean> {
    const incident = await this.incidents.findModerationWorkflowIncident(incidentId, session);
    if (
      !incident ||
      incident.communityState !== 'CONFLICTED' ||
      incident.moderationState !== 'NOT_QUEUED'
    ) {
      return false;
    }

    const existingCase = await this.moderation.findCaseByIncident(incidentId, session);
    if (existingCase) return false;

    const previousLifecycle = lifecycleSnapshot(incident);
    const transition = planIncidentLifecycleTransition(previousLifecycle, { type: 'QUEUE' });
    const queuedAt = this.now();
    const moderationCase = await this.moderation.createCase(
      {
        incidentId,
        sources: ['COMMUNITY_CONFLICT'],
        priority: 'NORMAL',
        flagCount: 0,
        reasonCounts: emptyReasonCounts(),
        queuedAt,
        latestActivityAt: queuedAt,
      },
      session,
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

    await this.moderation.createAuditLog(
      {
        caseId: moderationCase._id.toString(),
        incidentId,
        actorType: 'SYSTEM',
        action: 'CASE_QUEUED',
        reason: 'Conflicted community evidence queued a moderation case.',
        previousCaseState: null,
        newCaseState: {
          state: moderationCase.state,
          priority: moderationCase.priority,
          caseRevision: moderationCase.caseRevision,
        },
        previousIncidentLifecycle: previousLifecycle,
        newIncidentLifecycle: {
          ...transition.next,
          status: transition.legacyStatus,
        },
      },
      session,
    );

    return true;
  }
}

export function createModerationIntakeReconciliationService(): ModerationIntakeReconciliationService {
  return new ModerationIntakeReconciliationService(
    new IncidentRepository(),
    new ModerationRepository(),
  );
}
