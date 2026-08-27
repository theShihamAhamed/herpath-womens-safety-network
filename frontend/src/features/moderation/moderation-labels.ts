import type {
  IncidentCommunityState,
  IncidentFlagReason,
  IncidentModerationState,
  IncidentVisibilityState,
  ModerationAssignmentState,
  ModerationAuditAction,
  ModerationAuditActorType,
  ModerationCaseSource,
  ModerationCaseState,
  ModerationDecisionAction,
  ModerationPriority,
  ModerationResolution,
} from './moderation.types';

export const MODERATION_CASE_STATE_LABELS = {
  QUEUED: 'Queued',
  IN_REVIEW: 'In review',
  RESOLVED: 'Resolved',
} as const satisfies Record<ModerationCaseState, string>;

export const MODERATION_PRIORITY_LABELS = {
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
} as const satisfies Record<ModerationPriority, string>;

export const MODERATION_ASSIGNMENT_LABELS = {
  UNASSIGNED: 'Unassigned',
  ASSIGNED_TO_ME: 'Assigned to me',
  ASSIGNED_TO_OTHER: 'Assigned to another moderator',
} as const satisfies Record<ModerationAssignmentState, string>;

export const MODERATION_CASE_SOURCE_LABELS = {
  USER_FLAG: 'User flag',
  COMMUNITY_CONFLICT: 'Community evidence conflict',
} as const satisfies Record<ModerationCaseSource, string>;

export const MODERATION_RESOLUTION_LABELS = {
  NO_ACTION: 'No visibility change',
  HIDDEN: 'Hidden',
  RESTORED: 'Restored',
  ARCHIVED: 'Archived',
  ARCHIVED_DUPLICATE: 'Archived as duplicate',
} as const satisfies Record<ModerationResolution, string>;

export const MODERATION_DECISION_ACTION_LABELS = {
  NO_ACTION: 'No visibility change',
  HIDE: 'Hide incident',
  RESTORE: 'Restore incident',
  ARCHIVE: 'Archive incident',
  ARCHIVE_DUPLICATE: 'Archive as duplicate',
} as const satisfies Record<ModerationDecisionAction, string>;

export const INCIDENT_VISIBILITY_LABELS = {
  PUBLIC: 'Public',
  HIDDEN: 'Hidden',
  ARCHIVED: 'Archived',
} as const satisfies Record<IncidentVisibilityState, string>;

export const INCIDENT_COMMUNITY_STATE_LABELS = {
  UNVERIFIED: 'Unverified',
  SUPPORTED: 'Community supported',
  CONFLICTED: 'Conflicted',
  LIKELY_RESOLVED: 'Likely resolved',
  STALE: 'Stale',
} as const satisfies Record<IncidentCommunityState, string>;

export const INCIDENT_MODERATION_STATE_LABELS = {
  NOT_QUEUED: 'Not queued',
  QUEUED: 'Queued',
  IN_REVIEW: 'In review',
  AWAITING_REPORTER: 'Awaiting reporter',
  RESOLVED: 'Resolved',
} as const satisfies Record<IncidentModerationState, string>;

export const INCIDENT_FLAG_REASON_LABELS = {
  INACCURATE: 'Inaccurate',
  SPAM: 'Spam',
  DUPLICATE: 'Duplicate',
  HARMFUL_CONTENT: 'Harmful content',
  PRIVACY_VIOLATION: 'Privacy violation',
  MISLEADING: 'Misleading',
  OTHER: 'Other',
} as const satisfies Record<IncidentFlagReason, string>;

export const MODERATION_AUDIT_ACTOR_LABELS = {
  SYSTEM: 'System',
  MODERATOR: 'Moderator',
} as const satisfies Record<ModerationAuditActorType, string>;

export const MODERATION_AUDIT_ACTION_LABELS = {
  CASE_QUEUED: 'Case queued',
  CASE_REOPENED: 'Case reopened',
  CASE_PRIORITY_CHANGED: 'Priority changed',
  CASE_CLAIMED: 'Case claimed',
  CASE_RELEASED: 'Case returned to queue',
  DECISION_NO_ACTION: 'No visibility change',
  DECISION_HIDE: 'Incident hidden',
  DECISION_RESTORE: 'Incident restored',
  DECISION_ARCHIVE: 'Incident archived',
  DECISION_ARCHIVE_DUPLICATE: 'Incident archived as duplicate',
} as const satisfies Record<ModerationAuditAction, string>;
