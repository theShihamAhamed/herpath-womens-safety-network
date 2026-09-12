import type {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
} from '@/src/features/incidents/incident.types';

export const INCIDENT_VISIBILITY_STATES = ['PUBLIC', 'HIDDEN', 'ARCHIVED'] as const;
export const INCIDENT_COMMUNITY_STATES = [
  'UNVERIFIED',
  'SUPPORTED',
  'CONFLICTED',
  'LIKELY_RESOLVED',
  'STALE',
] as const;
export const INCIDENT_MODERATION_STATES = [
  'NOT_QUEUED',
  'QUEUED',
  'IN_REVIEW',
  'AWAITING_REPORTER',
  'RESOLVED',
] as const;

export const MODERATION_CASE_STATES = ['QUEUED', 'IN_REVIEW', 'RESOLVED'] as const;
export const MODERATION_CASE_SOURCES = ['USER_FLAG', 'COMMUNITY_CONFLICT'] as const;
export const MODERATION_PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'] as const;
export const MODERATION_ASSIGNMENT_FILTERS = ['ANY', 'UNASSIGNED', 'MINE'] as const;
export const MODERATION_ASSIGNMENT_STATES = [
  'UNASSIGNED',
  'ASSIGNED_TO_ME',
  'ASSIGNED_TO_OTHER',
] as const;
export const MODERATION_RESOLUTIONS = [
  'NO_ACTION',
  'HIDDEN',
  'RESTORED',
  'ARCHIVED',
  'ARCHIVED_DUPLICATE',
] as const;
export const MODERATION_DECISION_ACTIONS = [
  'NO_ACTION',
  'HIDE',
  'RESTORE',
  'ARCHIVE',
  'ARCHIVE_DUPLICATE',
] as const;
export const INCIDENT_FLAG_REASONS = [
  'INACCURATE',
  'SPAM',
  'DUPLICATE',
  'HARMFUL_CONTENT',
  'PRIVACY_VIOLATION',
  'MISLEADING',
  'OTHER',
] as const;
export const MODERATION_AUDIT_ACTOR_TYPES = ['SYSTEM', 'MODERATOR'] as const;
export const MODERATION_AUDIT_ACTIONS = [
  'CASE_QUEUED',
  'CASE_REOPENED',
  'CASE_PRIORITY_CHANGED',
  'CASE_CLAIMED',
  'CASE_RELEASED',
  'DECISION_NO_ACTION',
  'DECISION_HIDE',
  'DECISION_RESTORE',
  'DECISION_ARCHIVE',
  'DECISION_ARCHIVE_DUPLICATE',
] as const;

export type IncidentVisibilityState = (typeof INCIDENT_VISIBILITY_STATES)[number];
export type IncidentCommunityState = (typeof INCIDENT_COMMUNITY_STATES)[number];
export type IncidentModerationState = (typeof INCIDENT_MODERATION_STATES)[number];
export type ModerationCaseState = (typeof MODERATION_CASE_STATES)[number];
export type ModerationCaseSource = (typeof MODERATION_CASE_SOURCES)[number];
export type ModerationPriority = (typeof MODERATION_PRIORITIES)[number];
export type ModerationAssignmentFilter = (typeof MODERATION_ASSIGNMENT_FILTERS)[number];
export type ModerationAssignmentState = (typeof MODERATION_ASSIGNMENT_STATES)[number];
export type ModerationResolution = (typeof MODERATION_RESOLUTIONS)[number];
export type ModerationDecisionAction = (typeof MODERATION_DECISION_ACTIONS)[number];
export type IncidentFlagReason = (typeof INCIDENT_FLAG_REASONS)[number];
export type ModerationAuditActorType = (typeof MODERATION_AUDIT_ACTOR_TYPES)[number];
export type ModerationAuditAction = (typeof MODERATION_AUDIT_ACTIONS)[number];

export type IncidentFlagReasonCounts = Record<IncidentFlagReason, number>;

export interface ModerationAssignment {
  state: ModerationAssignmentState;
}

export interface ModerationQueueIncident {
  id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  occurredAt: string;
  lifecycleRevision: number;
}

export interface ModerationQueueCase {
  id: string;
  incident: ModerationQueueIncident;
  state: ModerationCaseState;
  priority: ModerationPriority;
  assignment: ModerationAssignment;
  flagCount: number;
  caseRevision: number;
  queuedAt: string;
  latestActivityAt: string;
}

export interface ModerationCaseQueuePage {
  items: ModerationQueueCase[];
  nextCursor: string | null;
}

export interface ModerationCaseQueueQuery {
  state?: ModerationCaseState;
  priority?: ModerationPriority;
  assignment?: ModerationAssignmentFilter;
  limit?: number;
  cursor?: string;
}

export interface ModerationWorkflowRevisionInput {
  clientActionId: string;
  expectedCaseRevision: number;
  expectedLifecycleRevision: number;
}

export type ClaimModerationCaseInput = ModerationWorkflowRevisionInput;

export interface ReasonedModerationCaseInput extends ModerationWorkflowRevisionInput {
  reason: string;
}

export interface DecideModerationCaseInput extends ReasonedModerationCaseInput {
  action: ModerationDecisionAction;
  relatedIncidentId?: string;
}

export interface ModerationQueueFilters {
  state: ModerationCaseState;
  assignment: ModerationAssignmentFilter;
  priority?: ModerationPriority;
}

export interface ModerationIncidentSummary {
  id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  visibilityState: IncidentVisibilityState;
  communityState: IncidentCommunityState;
  moderationState: IncidentModerationState;
  supportCount: number;
  occurredAt: string;
  createdAt: string;
  description?: string;
  lifecycleRevision: number;
}

export interface ModerationCommunityEvidence {
  communityState: IncidentCommunityState;
  supportCount: number;
  activeFeedbackCount: number;
  evidenceRevision: number;
  evaluatedAt: string;
}

export interface ModerationFlagSummary {
  total: number;
  byReason: IncidentFlagReasonCounts;
}

export interface ModerationCaseDetail {
  id: string;
  state: ModerationCaseState;
  priority: ModerationPriority;
  assignment: ModerationAssignment;
  sources: ModerationCaseSource[];
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
  communityEvidence: ModerationCommunityEvidence;
  flags: ModerationFlagSummary;
}

export interface ModerationCaseAuditSnapshot {
  state: ModerationCaseState;
  priority: ModerationPriority;
  caseRevision: number;
}

export interface IncidentLifecycleAuditSnapshot {
  visibilityState: IncidentVisibilityState;
  communityState: IncidentCommunityState;
  moderationState: IncidentModerationState;
  lifecycleRevision: number;
  status: IncidentStatus;
}

export interface ModerationAuditHistoryItem {
  id: string;
  actorType: ModerationAuditActorType;
  action: ModerationAuditAction;
  previousCaseState: ModerationCaseAuditSnapshot | null;
  newCaseState: ModerationCaseAuditSnapshot;
  previousIncidentLifecycle: IncidentLifecycleAuditSnapshot;
  newIncidentLifecycle: IncidentLifecycleAuditSnapshot;
  createdAt: string;
}
