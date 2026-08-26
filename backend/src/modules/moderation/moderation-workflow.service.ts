import { Buffer } from 'node:buffer';

import mongoose, { Types, type ClientSession } from 'mongoose';

import { AppError } from '../../common/errors/app-error.js';
import {
  createCommunityEvidenceReader,
} from '../community-verification/community-evidence.reader.js';
import type {
  CommunityEvidenceRead,
  CommunityEvidenceReader,
} from '../community-verification/community-evidence.reader.js';
import { planIncidentLifecycleTransition } from '../incidents/incident-lifecycle.service.js';
import type { IncidentDocument } from '../incidents/incident.model.js';
import { IncidentRepository } from '../incidents/incident.repository.js';
import type { ModerationAuditLogDocument } from './moderation-audit.model.js';
import type { ModerationCaseDocument } from './moderation-case.model.js';
import { ModerationRepository } from './moderation.repository.js';
import type {
  IncidentFlagReasonCounts,
  IncidentLifecycleAuditSnapshot,
  ModerationAssignmentState,
  ModerationAuditAction,
  ModerationCaseQueueCursor,
  ModerationCaseRevisionUpdate,
  ModerationDecisionAction,
  ModerationResolution,
} from './moderation.types.js';
import type {
  ClaimModerationCaseInput,
  DecideModerationCaseInput,
  ModerationCaseQueueQuery,
  ReleaseModerationCaseInput,
  ReopenModerationCaseInput,
} from './moderation-workflow.validation.js';

export interface ModerationAssignmentProjection {
  state: ModerationAssignmentState;
}

export interface ModerationQueueIncidentProjection {
  id: string;
  category: IncidentDocument['category'];
  severity: IncidentDocument['severity'];
  occurredAt: string;
  lifecycleRevision: number;
}

export interface ModerationQueueCaseProjection {
  id: string;
  incident: ModerationQueueIncidentProjection;
  state: ModerationCaseDocument['state'];
  priority: ModerationCaseDocument['priority'];
  assignment: ModerationAssignmentProjection;
  flagCount: number;
  caseRevision: number;
  queuedAt: string;
  latestActivityAt: string;
}

export interface ModerationCaseQueuePage {
  items: ModerationQueueCaseProjection[];
  nextCursor: string | null;
}

export interface ModerationIncidentSummary {
  id: string;
  category: IncidentDocument['category'];
  severity: IncidentDocument['severity'];
  status: IncidentDocument['status'];
  visibilityState: IncidentDocument['visibilityState'];
  communityState: IncidentDocument['communityState'];
  moderationState: IncidentDocument['moderationState'];
  supportCount: number;
  occurredAt: string;
  createdAt: string;
  description?: string;
  lifecycleRevision: number;
}

export interface ModerationFlagSummary {
  total: number;
  byReason: IncidentFlagReasonCounts;
}

export interface ModerationCaseDetail {
  id: string;
  state: ModerationCaseDocument['state'];
  priority: ModerationCaseDocument['priority'];
  assignment: ModerationAssignmentProjection;
  sources: ModerationCaseDocument['sources'];
  caseRevision: number;
  queuedAt: string;
  reviewStartedAt: string | null;
  resolvedAt: string | null;
  latestActivityAt: string;
  createdAt: string;
  updatedAt: string;
  resolution: ModerationResolution | null;
  resolutionReason: string | null;
  relatedIncidentId: string | null;
  incident: ModerationIncidentSummary;
  communityEvidence: CommunityEvidenceRead;
  flags: ModerationFlagSummary;
}

type WorkflowAction = 'CLAIM' | 'RELEASE' | 'REOPEN';

interface WorkflowInput {
  clientActionId: string;
  expectedCaseRevision: number;
  expectedLifecycleRevision: number;
  reason: string;
}

interface DecisionIntent {
  action: ModerationDecisionAction;
  clientActionId: string;
  expectedCaseRevision: number;
  expectedLifecycleRevision: number;
  reason: string;
  relatedIncidentId?: string | undefined;
}

function caseNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: 'MODERATION_CASE_NOT_FOUND',
    message: 'The moderation case is not available.',
  });
}

function revisionConflict(): AppError {
  return new AppError({
    statusCode: 409,
    code: 'MODERATION_REVISION_CONFLICT',
    message: 'The moderation case changed. Refresh it before trying again.',
  });
}

function stateConflict(message: string): AppError {
  return new AppError({
    statusCode: 409,
    code: 'MODERATION_CASE_STATE_CONFLICT',
    message,
  });
}

function assignmentDenied(): AppError {
  return new AppError({
    statusCode: 403,
    code: 'MODERATION_CASE_ASSIGNMENT_REQUIRED',
    message: 'Only the assigned moderator can release this case.',
  });
}

function idempotencyConflict(): AppError {
  return new AppError({
    statusCode: 409,
    code: 'IDEMPOTENCY_CONFLICT',
    message: 'This moderator action identifier was already used for a different action.',
  });
}

function invalidCursor(error: unknown): AppError {
  return new AppError({
    statusCode: 400,
    code: 'INVALID_CURSOR',
    message: 'The moderation queue cursor is invalid.',
    cause: error,
  });
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

function assignmentProjection(
  moderationCase: ModerationCaseDocument,
  moderatorId: string,
): ModerationAssignmentProjection {
  if (moderationCase.assignedModeratorId === null) return { state: 'UNASSIGNED' };
  return {
    state:
      moderationCase.assignedModeratorId.toString() === moderatorId
        ? 'ASSIGNED_TO_ME'
        : 'ASSIGNED_TO_OTHER',
  };
}

function copyReasonCounts(moderationCase: ModerationCaseDocument): IncidentFlagReasonCounts {
  return {
    INACCURATE: moderationCase.reasonCounts.INACCURATE,
    SPAM: moderationCase.reasonCounts.SPAM,
    DUPLICATE: moderationCase.reasonCounts.DUPLICATE,
    HARMFUL_CONTENT: moderationCase.reasonCounts.HARMFUL_CONTENT,
    PRIVACY_VIOLATION: moderationCase.reasonCounts.PRIVACY_VIOLATION,
    MISLEADING: moderationCase.reasonCounts.MISLEADING,
    OTHER: moderationCase.reasonCounts.OTHER,
  };
}

function caseUpdate(
  moderationCase: ModerationCaseDocument,
  overrides: Partial<ModerationCaseRevisionUpdate>,
): ModerationCaseRevisionUpdate {
  return {
    sources: [...moderationCase.sources],
    state: moderationCase.state,
    priority: moderationCase.priority,
    assignedModeratorId: moderationCase.assignedModeratorId?.toString() ?? null,
    flagCount: moderationCase.flagCount,
    reasonCounts: copyReasonCounts(moderationCase),
    resolution: moderationCase.resolution,
    resolutionReason: moderationCase.resolutionReason,
    relatedIncidentId: moderationCase.relatedIncidentId?.toString() ?? null,
    queuedAt: moderationCase.queuedAt,
    reviewStartedAt: moderationCase.reviewStartedAt,
    resolvedAt: moderationCase.resolvedAt,
    latestActivityAt: moderationCase.latestActivityAt,
    ...overrides,
  };
}

function actionAuditType(action: WorkflowAction): ModerationAuditAction {
  if (action === 'CLAIM') return 'CASE_CLAIMED';
  if (action === 'RELEASE') return 'CASE_RELEASED';
  return 'CASE_REOPENED';
}

function decisionAuditType(action: ModerationDecisionAction): ModerationAuditAction {
  switch (action) {
    case 'NO_ACTION':
      return 'DECISION_NO_ACTION';
    case 'HIDE':
      return 'DECISION_HIDE';
    case 'RESTORE':
      return 'DECISION_RESTORE';
    case 'ARCHIVE':
      return 'DECISION_ARCHIVE';
    case 'ARCHIVE_DUPLICATE':
      return 'DECISION_ARCHIVE_DUPLICATE';
  }
}

function targetVisibility(
  action: ModerationDecisionAction,
  current: IncidentDocument['visibilityState'],
): IncidentDocument['visibilityState'] {
  if (action === 'NO_ACTION') return current;
  if (action === 'HIDE') {
    if (current !== 'PUBLIC') throw stateConflict('Only a public incident can be hidden.');
    return 'HIDDEN';
  }
  if (action === 'RESTORE') {
    if (current !== 'HIDDEN' && current !== 'ARCHIVED') {
      throw stateConflict('Only a hidden or archived incident can be restored.');
    }
    return 'PUBLIC';
  }
  if (current !== 'PUBLIC' && current !== 'HIDDEN') {
    throw stateConflict('Only a public or hidden incident can be archived.');
  }
  return 'ARCHIVED';
}

function decisionResolution(action: ModerationDecisionAction): ModerationResolution {
  switch (action) {
    case 'NO_ACTION':
      return 'NO_ACTION';
    case 'HIDE':
      return 'HIDDEN';
    case 'RESTORE':
      return 'RESTORED';
    case 'ARCHIVE':
      return 'ARCHIVED';
    case 'ARCHIVE_DUPLICATE':
      return 'ARCHIVED_DUPLICATE';
  }
}

function encodeCursor(moderationCase: ModerationCaseDocument): string {
  return Buffer.from(
    JSON.stringify({
      priorityRank: moderationCase.priorityRank,
      latestActivityAt: moderationCase.latestActivityAt.toISOString(),
      id: moderationCase._id.toString(),
    }),
    'utf8',
  ).toString('base64url');
}

function decodeCursor(value: string): ModerationCaseQueueCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('priorityRank' in parsed) ||
      !('latestActivityAt' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.priorityRank !== 'number' ||
      !Number.isInteger(parsed.priorityRank) ||
      parsed.priorityRank < 1 ||
      parsed.priorityRank > 3 ||
      typeof parsed.latestActivityAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !Types.ObjectId.isValid(parsed.id)
    ) {
      throw new Error('Invalid cursor shape');
    }
    const latestActivityAt = new Date(parsed.latestActivityAt);
    if (!Number.isFinite(latestActivityAt.getTime())) throw new Error('Invalid cursor date');
    return { priorityRank: parsed.priorityRank, latestActivityAt, id: parsed.id };
  } catch (error) {
    throw invalidCursor(error);
  }
}

export class ModerationWorkflowService {
  private readonly now: () => Date;

  public constructor(
    private readonly moderation: ModerationRepository,
    private readonly incidents: IncidentRepository,
    private readonly evidence: CommunityEvidenceReader,
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  public async queue(
    moderatorId: string,
    query: ModerationCaseQueueQuery,
  ): Promise<ModerationCaseQueuePage> {
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const cases = await this.moderation.findCasePage(
      {
        ...(query.state === undefined ? {} : { state: query.state }),
        ...(query.priority === undefined ? {} : { priority: query.priority }),
        assignment: query.assignment,
        moderatorId,
      },
      query.limit + 1,
      cursor,
    );
    const hasNextPage = cases.length > query.limit;
    const pageCases = cases.slice(0, query.limit);
    const incidents = await this.incidents.findModerationCaseIncidents(
      pageCases.map((moderationCase) => moderationCase.incidentId.toString()),
    );
    const incidentById = new Map(
      incidents.map((incident) => [incident._id.toString(), incident] as const),
    );
    const items = pageCases.flatMap((moderationCase) => {
      const incident = incidentById.get(moderationCase.incidentId.toString());
      if (!incident) return [];
      return [this.queueProjection(moderatorId, moderationCase, incident)];
    });
    const lastCase = pageCases.at(-1);
    return {
      items,
      nextCursor: hasNextPage && lastCase ? encodeCursor(lastCase) : null,
    };
  }

  public async detail(moderatorId: string, caseId: string): Promise<ModerationCaseDetail> {
    const moderationCase = await this.moderation.findCaseById(caseId);
    if (!moderationCase) throw caseNotFound();
    const incident = await this.incidents.findModerationCaseIncident(
      moderationCase.incidentId.toString(),
    );
    if (!incident) throw caseNotFound();
    return this.detailProjection(moderatorId, moderationCase, incident);
  }

  public async claim(
    moderatorId: string,
    caseId: string,
    input: ClaimModerationCaseInput,
  ): Promise<ModerationCaseDetail> {
    return this.performWorkflowAction(moderatorId, caseId, 'CLAIM', {
      ...input,
      reason: 'Moderator claimed the case.',
    });
  }

  public async release(
    moderatorId: string,
    caseId: string,
    input: ReleaseModerationCaseInput,
  ): Promise<ModerationCaseDetail> {
    return this.performWorkflowAction(moderatorId, caseId, 'RELEASE', input);
  }

  public async reopen(
    moderatorId: string,
    caseId: string,
    input: ReopenModerationCaseInput,
  ): Promise<ModerationCaseDetail> {
    return this.performWorkflowAction(moderatorId, caseId, 'REOPEN', input);
  }

  public async decide(
    moderatorId: string,
    caseId: string,
    input: DecideModerationCaseInput,
  ): Promise<ModerationCaseDetail> {
    const initialReplay = await this.moderation.findAuditByIdempotencyKey(
      moderatorId,
      input.clientActionId,
    );
    if (initialReplay) {
      this.assertMatchingDecisionReplay(initialReplay, caseId, input);
      return this.detail(moderatorId, caseId);
    }

    try {
      return await mongoose.connection.transaction(async (session) => {
        const replay = await this.moderation.findAuditByIdempotencyKey(
          moderatorId,
          input.clientActionId,
          session,
        );
        if (replay) {
          this.assertMatchingDecisionReplay(replay, caseId, input);
          return this.detailInSession(moderatorId, caseId, session);
        }

        const moderationCase = await this.moderation.findCaseById(caseId, session);
        if (!moderationCase) throw caseNotFound();
        const incident = await this.incidents.findModerationWorkflowIncident(
          moderationCase.incidentId.toString(),
          session,
        );
        if (!incident) throw caseNotFound();
        this.assertExpectedRevisions(moderationCase, incident, input);
        if (moderationCase.assignedModeratorId?.toString() !== moderatorId) {
          throw new AppError({
            statusCode: 403,
            code: 'MODERATION_CASE_ASSIGNMENT_REQUIRED',
            message: 'Only the assigned moderator can decide this case.',
          });
        }
        if (moderationCase.state !== 'IN_REVIEW' || incident.moderationState !== 'IN_REVIEW') {
          throw stateConflict('Only a case in active review can receive a decision.');
        }
        if (incident.reporterId.toString() === moderatorId) {
          throw new AppError({
            statusCode: 403,
            code: 'SELF_MODERATION_NOT_ALLOWED',
            message: 'Moderators cannot decide cases for their own incident reports.',
          });
        }
        await this.validateRelatedIncident(incident, input, session);

        const previousLifecycle = lifecycleSnapshot(incident);
        const evaluatedAt = this.now();
        const visibilityState = targetVisibility(input.action, incident.visibilityState);
        const transition = planIncidentLifecycleTransition(
          {
            visibilityState: incident.visibilityState,
            communityState: incident.communityState,
            moderationState: incident.moderationState,
            lifecycleRevision: incident.lifecycleRevision,
          },
          { type: 'RESOLVE_REVIEW_WITH_VISIBILITY', visibilityState },
        );
        const updatedCase = await this.moderation.updateCaseWithRevision(
          caseId,
          moderationCase.caseRevision,
          caseUpdate(moderationCase, {
            state: 'RESOLVED',
            resolution: decisionResolution(input.action),
            resolutionReason: input.reason,
            relatedIncidentId: input.relatedIncidentId ?? null,
            resolvedAt: evaluatedAt,
            latestActivityAt: evaluatedAt,
          }),
          session,
        );
        if (!updatedCase) throw revisionConflict();
        const updatedIncident = await this.incidents.saveModerationDecision(
          incident,
          {
            visibilityState: transition.next.visibilityState,
            moderationState: transition.next.moderationState,
            status: transition.legacyStatus,
            lifecycleRevision: transition.next.lifecycleRevision,
          },
          session,
        );
        await this.moderation.createAuditLog(
          {
            caseId,
            incidentId: incident._id.toString(),
            actorType: 'MODERATOR',
            moderatorId,
            clientActionId: input.clientActionId,
            action: decisionAuditType(input.action),
            reason: input.reason,
            previousCaseState: {
              state: moderationCase.state,
              priority: moderationCase.priority,
              caseRevision: moderationCase.caseRevision,
            },
            newCaseState: {
              state: updatedCase.state,
              priority: updatedCase.priority,
              caseRevision: updatedCase.caseRevision,
            },
            previousIncidentLifecycle: previousLifecycle,
            newIncidentLifecycle: lifecycleSnapshot(updatedIncident),
            ...(input.relatedIncidentId === undefined
              ? {}
              : { relatedIncidentId: input.relatedIncidentId }),
          },
          session,
        );
        return this.detailProjection(moderatorId, updatedCase, updatedIncident, session);
      });
    } catch (error) {
      const committedReplay = await this.moderation.findAuditByIdempotencyKey(
        moderatorId,
        input.clientActionId,
      );
      if (committedReplay) {
        this.assertMatchingDecisionReplay(committedReplay, caseId, input);
        return this.detail(moderatorId, caseId);
      }
      throw error;
    }
  }

  private async performWorkflowAction(
    moderatorId: string,
    caseId: string,
    action: WorkflowAction,
    input: WorkflowInput,
  ): Promise<ModerationCaseDetail> {
    const initialReplay = await this.moderation.findAuditByIdempotencyKey(
      moderatorId,
      input.clientActionId,
    );
    if (initialReplay) {
      this.assertMatchingReplay(initialReplay, caseId, action, input);
      return this.detail(moderatorId, caseId);
    }

    try {
      return await mongoose.connection.transaction(async (session) => {
        const replay = await this.moderation.findAuditByIdempotencyKey(
          moderatorId,
          input.clientActionId,
          session,
        );
        if (replay) {
          this.assertMatchingReplay(replay, caseId, action, input);
          return this.detailInSession(moderatorId, caseId, session);
        }

        const moderationCase = await this.moderation.findCaseById(caseId, session);
        if (!moderationCase) throw caseNotFound();
        const incident = await this.incidents.findModerationWorkflowIncident(
          moderationCase.incidentId.toString(),
          session,
        );
        if (!incident) throw caseNotFound();
        this.assertExpectedRevisions(moderationCase, incident, input);

        const previousLifecycle = lifecycleSnapshot(incident);
        const evaluatedAt = this.now();
        const updatedCase = await this.applyCaseAction(
          moderatorId,
          moderationCase,
          incident,
          action,
          evaluatedAt,
          session,
        );
        const updatedIncident = await this.applyIncidentAction(
          incident,
          action,
          session,
        );
        await this.moderation.createAuditLog(
          {
            caseId,
            incidentId: incident._id.toString(),
            actorType: 'MODERATOR',
            moderatorId,
            clientActionId: input.clientActionId,
            action: actionAuditType(action),
            reason: input.reason,
            previousCaseState: {
              state: moderationCase.state,
              priority: moderationCase.priority,
              caseRevision: moderationCase.caseRevision,
            },
            newCaseState: {
              state: updatedCase.state,
              priority: updatedCase.priority,
              caseRevision: updatedCase.caseRevision,
            },
            previousIncidentLifecycle: previousLifecycle,
            newIncidentLifecycle: lifecycleSnapshot(updatedIncident),
          },
          session,
        );
        return this.detailProjection(moderatorId, updatedCase, updatedIncident, session);
      });
    } catch (error) {
      const committedReplay = await this.moderation.findAuditByIdempotencyKey(
        moderatorId,
        input.clientActionId,
      );
      if (committedReplay) {
        this.assertMatchingReplay(committedReplay, caseId, action, input);
        return this.detail(moderatorId, caseId);
      }
      throw error;
    }
  }

  private assertMatchingReplay(
    audit: ModerationAuditLogDocument,
    caseId: string,
    action: WorkflowAction,
    input: WorkflowInput,
  ): void {
    const matches =
      audit.caseId.toString() === caseId &&
      audit.action === actionAuditType(action) &&
      audit.reason === input.reason &&
      audit.previousCaseState?.caseRevision === input.expectedCaseRevision &&
      audit.previousIncidentLifecycle.lifecycleRevision === input.expectedLifecycleRevision;
    if (!matches) throw idempotencyConflict();
  }

  private assertMatchingDecisionReplay(
    audit: ModerationAuditLogDocument,
    caseId: string,
    input: DecisionIntent,
  ): void {
    const matches =
      audit.caseId.toString() === caseId &&
      audit.action === decisionAuditType(input.action) &&
      audit.reason === input.reason &&
      audit.previousCaseState?.caseRevision === input.expectedCaseRevision &&
      audit.previousIncidentLifecycle.lifecycleRevision === input.expectedLifecycleRevision &&
      (audit.relatedIncidentId?.toString() ?? null) === (input.relatedIncidentId ?? null);
    if (!matches) throw idempotencyConflict();
  }

  private async validateRelatedIncident(
    incident: IncidentDocument,
    input: DecisionIntent,
    session: ClientSession,
  ): Promise<void> {
    if (input.action !== 'ARCHIVE_DUPLICATE') return;
    if (
      input.relatedIncidentId === undefined ||
      input.relatedIncidentId === incident._id.toString() ||
      !(await this.incidents.moderationDecisionRelatedIncidentExists(
        input.relatedIncidentId,
        session,
      ))
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_RELATED_INCIDENT',
        message: 'The related incident must identify a different existing incident.',
      });
    }
  }

  private assertExpectedRevisions(
    moderationCase: ModerationCaseDocument,
    incident: IncidentDocument,
    input: WorkflowInput,
  ): void {
    if (
      moderationCase.caseRevision !== input.expectedCaseRevision ||
      incident.lifecycleRevision !== input.expectedLifecycleRevision
    ) {
      throw revisionConflict();
    }
  }

  private async applyCaseAction(
    moderatorId: string,
    moderationCase: ModerationCaseDocument,
    incident: IncidentDocument,
    action: WorkflowAction,
    evaluatedAt: Date,
    session: ClientSession,
  ): Promise<ModerationCaseDocument> {
    let update: ModerationCaseRevisionUpdate;
    if (action === 'CLAIM') {
      if (
        moderationCase.state !== 'QUEUED' ||
        moderationCase.assignedModeratorId !== null ||
        incident.moderationState !== 'QUEUED'
      ) {
        throw stateConflict('Only an unassigned queued case can be claimed.');
      }
      update = caseUpdate(moderationCase, {
        state: 'IN_REVIEW',
        assignedModeratorId: moderatorId,
        reviewStartedAt: evaluatedAt,
        latestActivityAt: evaluatedAt,
      });
    } else if (action === 'RELEASE') {
      if (moderationCase.assignedModeratorId?.toString() !== moderatorId) {
        throw assignmentDenied();
      }
      if (moderationCase.state !== 'IN_REVIEW' || incident.moderationState !== 'IN_REVIEW') {
        throw stateConflict('Only a case in active review can be released.');
      }
      update = caseUpdate(moderationCase, {
        state: 'QUEUED',
        assignedModeratorId: null,
        latestActivityAt: evaluatedAt,
      });
    } else {
      if (moderationCase.state !== 'RESOLVED' || incident.moderationState !== 'RESOLVED') {
        throw stateConflict('Only a resolved case can be reopened.');
      }
      update = caseUpdate(moderationCase, {
        state: 'QUEUED',
        assignedModeratorId: null,
        resolution: null,
        resolutionReason: null,
        relatedIncidentId: null,
        queuedAt: evaluatedAt,
        reviewStartedAt: null,
        resolvedAt: null,
        latestActivityAt: evaluatedAt,
      });
    }

    const updated = await this.moderation.updateCaseWithRevision(
      moderationCase._id.toString(),
      moderationCase.caseRevision,
      update,
      session,
    );
    if (!updated) throw revisionConflict();
    return updated;
  }

  private async applyIncidentAction(
    incident: IncidentDocument,
    action: WorkflowAction,
    session: ClientSession,
  ): Promise<IncidentDocument> {
    const lifecycleAction =
      action === 'CLAIM'
        ? ({ type: 'START_REVIEW' } as const)
        : action === 'RELEASE'
          ? ({ type: 'RELEASE_REVIEW' } as const)
          : ({ type: 'REOPEN_REVIEW' } as const);
    const transition = planIncidentLifecycleTransition(
      {
        visibilityState: incident.visibilityState,
        communityState: incident.communityState,
        moderationState: incident.moderationState,
        lifecycleRevision: incident.lifecycleRevision,
      },
      lifecycleAction,
    );
    return this.incidents.saveModerationQueueState(
      incident,
      {
        moderationState: transition.next.moderationState,
        status: transition.legacyStatus,
        lifecycleRevision: transition.next.lifecycleRevision,
      },
      session,
    );
  }

  private async detailInSession(
    moderatorId: string,
    caseId: string,
    session: ClientSession,
  ): Promise<ModerationCaseDetail> {
    const moderationCase = await this.moderation.findCaseById(caseId, session);
    if (!moderationCase) throw caseNotFound();
    const incident = await this.incidents.findModerationCaseIncident(
      moderationCase.incidentId.toString(),
      session,
    );
    if (!incident) throw caseNotFound();
    return this.detailProjection(moderatorId, moderationCase, incident, session);
  }

  private queueProjection(
    moderatorId: string,
    moderationCase: ModerationCaseDocument,
    incident: IncidentDocument,
  ): ModerationQueueCaseProjection {
    return {
      id: moderationCase._id.toString(),
      incident: {
        id: incident._id.toString(),
        category: incident.category,
        severity: incident.severity,
        occurredAt: incident.occurredAt.toISOString(),
        lifecycleRevision: incident.lifecycleRevision,
      },
      state: moderationCase.state,
      priority: moderationCase.priority,
      assignment: assignmentProjection(moderationCase, moderatorId),
      flagCount: moderationCase.flagCount,
      caseRevision: moderationCase.caseRevision,
      queuedAt: moderationCase.queuedAt.toISOString(),
      latestActivityAt: moderationCase.latestActivityAt.toISOString(),
    };
  }

  private async detailProjection(
    moderatorId: string,
    moderationCase: ModerationCaseDocument,
    incident: IncidentDocument,
    session?: ClientSession,
  ): Promise<ModerationCaseDetail> {
    const evidence = await this.evidence.findByIncidentId(incident._id.toString(), session);
    return {
      id: moderationCase._id.toString(),
      state: moderationCase.state,
      priority: moderationCase.priority,
      assignment: assignmentProjection(moderationCase, moderatorId),
      sources: [...moderationCase.sources],
      caseRevision: moderationCase.caseRevision,
      queuedAt: moderationCase.queuedAt.toISOString(),
      reviewStartedAt: moderationCase.reviewStartedAt?.toISOString() ?? null,
      resolvedAt: moderationCase.resolvedAt?.toISOString() ?? null,
      latestActivityAt: moderationCase.latestActivityAt.toISOString(),
      createdAt: moderationCase.createdAt.toISOString(),
      updatedAt: moderationCase.updatedAt.toISOString(),
      resolution: moderationCase.resolution,
      resolutionReason: moderationCase.resolutionReason,
      relatedIncidentId: moderationCase.relatedIncidentId?.toString() ?? null,
      incident: {
        id: incident._id.toString(),
        category: incident.category,
        severity: incident.severity,
        status: incident.status,
        visibilityState: incident.visibilityState,
        communityState: incident.communityState,
        moderationState: incident.moderationState,
        supportCount: incident.supportCount,
        occurredAt: incident.occurredAt.toISOString(),
        createdAt: incident.createdAt.toISOString(),
        ...(incident.description === undefined ? {} : { description: incident.description }),
        lifecycleRevision: incident.lifecycleRevision,
      },
      communityEvidence:
        evidence ??
        {
          communityState: incident.communityState,
          supportCount: incident.supportCount,
          activeFeedbackCount: 0,
          evidenceRevision: 0,
          evaluatedAt: incident.updatedAt.toISOString(),
        },
      flags: {
        total: moderationCase.flagCount,
        byReason: copyReasonCounts(moderationCase),
      },
    };
  }
}

export function createModerationWorkflowService(): ModerationWorkflowService {
  return new ModerationWorkflowService(
    new ModerationRepository(),
    new IncidentRepository(),
    createCommunityEvidenceReader(),
  );
}
