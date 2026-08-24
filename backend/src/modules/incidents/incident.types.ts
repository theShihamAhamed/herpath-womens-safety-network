export const INCIDENT_CATEGORIES = [
  'HARASSMENT',
  'THEFT',
  'ASSAULT',
  'STALKING',
  'OTHER',
] as const;

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const INCIDENT_STATUSES = [
  'PENDING',
  'PUBLISHED_UNVERIFIED',
  'COMMUNITY_SUPPORTED',
  'MODERATOR_REVIEWED',
  'DISPUTED',
  'REJECTED',
  'ARCHIVED',
] as const;

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

export const INCIDENT_LOCATION_MODES = ['EXACT_PRIVATE', 'APPROXIMATE_ONLY'] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentVisibilityState = (typeof INCIDENT_VISIBILITY_STATES)[number];
export type IncidentCommunityState = (typeof INCIDENT_COMMUNITY_STATES)[number];
export type IncidentModerationState = (typeof INCIDENT_MODERATION_STATES)[number];
export type IncidentLocationMode = (typeof INCIDENT_LOCATION_MODES)[number];

export interface IncidentLifecycleState {
  visibilityState: IncidentVisibilityState;
  communityState: IncidentCommunityState;
  moderationState: IncidentModerationState;
}

export interface IncidentLifecycleSnapshot extends IncidentLifecycleState {
  lifecycleRevision: number;
}

export type IncidentLifecycleAction =
  | { type: 'SET_VISIBILITY'; visibilityState: IncidentVisibilityState }
  | { type: 'SET_COMMUNITY_STATE'; communityState: IncidentCommunityState }
  | { type: 'QUEUE' }
  | { type: 'START_REVIEW' }
  | { type: 'REQUEST_REPORTER_INFORMATION' }
  | { type: 'RESUME_REVIEW' }
  | { type: 'RESOLVE_REVIEW' }
  | { type: 'RELEASE_REVIEW' }
  | { type: 'DISMISS_QUEUE' }
  | { type: 'REOPEN_REVIEW' };

export interface IncidentLifecycleTransitionResult {
  changed: boolean;
  previous: IncidentLifecycleSnapshot;
  next: IncidentLifecycleSnapshot;
  legacyStatus: IncidentStatus;
}

export type Position = [longitude: number, latitude: number];

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: Position;
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: Position[][];
}

export interface ExactPrivateLocationInput {
  mode: 'EXACT_PRIVATE';
  privateLocation: GeoJsonPoint;
}

export interface ApproximateOnlyLocationInput {
  mode: 'APPROXIMATE_ONLY';
  publicCellId: string;
}

export type IncidentLocationInput = ExactPrivateLocationInput | ApproximateOnlyLocationInput;

export interface NormalizedIncidentLocation {
  locationMode: IncidentLocationMode;
  privateLocation: GeoJsonPoint | null;
  publicCellId: string;
  publicLocation: GeoJsonPoint;
}

export interface CreateIncidentPersistenceInput {
  reporterId: string;
  clientSubmissionId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  occurredAt: Date;
  description?: string;
  location: IncidentLocationInput;
}

export interface IncidentViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface PublicLocationCell {
  cellId: string;
  publicLocation: GeoJsonPoint;
  publicArea: GeoJsonPolygon;
}

export interface OwnerIncidentCursor {
  createdAt: Date;
  id: string;
}
