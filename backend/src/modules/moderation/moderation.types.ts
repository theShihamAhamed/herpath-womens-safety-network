import type {
  IncidentCommunityState,
  IncidentModerationState,
  IncidentStatus,
  IncidentVisibilityState,
} from '../incidents/incident.types.js';

export const INCIDENT_FLAG_REASONS = [
  'INACCURATE',
  'SPAM',
  'DUPLICATE',
  'HARMFUL_CONTENT',
  'PRIVACY_VIOLATION',
  'MISLEADING',
  'OTHER',
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

export type IncidentFlagReason = (typeof INCIDENT_FLAG_REASONS)[number];
export type ModerationCaseState = (typeof MODERATION_CASE_STATES)[number];
export type ModerationCaseSource = (typeof MODERATION_CASE_SOURCES)[number];
export type ModerationPriority = (typeof MODERATION_PRIORITIES)[number];
export type ModerationAssignmentFilter = (typeof MODERATION_ASSIGNMENT_FILTERS)[number];
export type ModerationAssignmentState = (typeof MODERATION_ASSIGNMENT_STATES)[number];
export type ModerationResolution = (typeof MODERATION_RESOLUTIONS)[number];
export type ModerationAuditActorType = (typeof MODERATION_AUDIT_ACTOR_TYPES)[number];
export type ModerationAuditAction = (typeof MODERATION_AUDIT_ACTIONS)[number];

export const MODERATION_PRIORITY_RANKS = {
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
} as const satisfies Record<ModerationPriority, number>;

export type IncidentFlagReasonCounts = Record<IncidentFlagReason, number>;

export interface ModerationCaseQueueCursor {
  priorityRank: number;
  latestActivityAt: Date;
  id: string;
}

export interface ModerationCaseQueueFilters {
  state?: ModerationCaseState;
  priority?: ModerationPriority;
  assignment: ModerationAssignmentFilter;
  moderatorId: string;
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

export interface CreateIncidentFlagPersistenceInput {
  incidentId: string;
  actorId: string;
  clientFlagId: string;
  reason: IncidentFlagReason;
  details?: string;
}

export interface CreateModerationCasePersistenceInput {
  incidentId: string;
  sources: ModerationCaseSource[];
  priority: ModerationPriority;
  flagCount: number;
  reasonCounts: IncidentFlagReasonCounts;
  queuedAt: Date;
  latestActivityAt: Date;
}

export interface ModerationCaseRevisionUpdate {
  sources: ModerationCaseSource[];
  state: ModerationCaseState;
  priority: ModerationPriority;
  assignedModeratorId: string | null;
  flagCount: number;
  reasonCounts: IncidentFlagReasonCounts;
  resolution: ModerationResolution | null;
  resolutionReason: string | null;
  relatedIncidentId: string | null;
  queuedAt: Date;
  reviewStartedAt: Date | null;
  resolvedAt: Date | null;
  latestActivityAt: Date;
}

export interface CreateModerationAuditPersistenceInput {
  caseId: string;
  incidentId: string;
  actorType: ModerationAuditActorType;
  moderatorId?: string;
  clientActionId?: string;
  action: ModerationAuditAction;
  reason: string;
  previousCaseState: ModerationCaseAuditSnapshot | null;
  newCaseState: ModerationCaseAuditSnapshot;
  previousIncidentLifecycle: IncidentLifecycleAuditSnapshot;
  newIncidentLifecycle: IncidentLifecycleAuditSnapshot;
  triggerFlagId?: string;
  relatedIncidentId?: string;
  requestId?: string;
}
