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

export const INCIDENT_LOCATION_MODES = ['EXACT_PRIVATE', 'APPROXIMATE_ONLY'] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentLocationMode = (typeof INCIDENT_LOCATION_MODES)[number];

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
