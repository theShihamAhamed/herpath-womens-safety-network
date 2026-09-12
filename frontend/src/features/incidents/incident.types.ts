export const INCIDENT_CATEGORIES = [
  'HARASSMENT',
  'THEFT',
  'ASSAULT',
  'STALKING',
  'OTHER',
] as const;

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentLocationMode = 'EXACT_PRIVATE' | 'APPROXIMATE_ONLY';
export type IncidentStatus =
  | 'PENDING'
  | 'PUBLISHED_UNVERIFIED'
  | 'COMMUNITY_SUPPORTED'
  | 'MODERATOR_REVIEWED'
  | 'DISPUTED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [longitude: number, latitude: number];
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [longitude: number, latitude: number][][];
}

export interface OwnerIncident {
  id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurredAt: string;
  createdAt: string;
  supportCount: number;
  locationMode: IncidentLocationMode;
  description?: string;
}

export interface SelectableLocationCell {
  cellId: string;
  publicLocation: GeoJsonPoint;
  publicArea: GeoJsonPolygon;
}

export type CreateIncidentInput = {
  clientSubmissionId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  occurredAt: string;
  description?: string;
  location:
    | { mode: 'EXACT_PRIVATE'; privateLocation: GeoJsonPoint }
    | { mode: 'APPROXIMATE_ONLY'; selectedAreaCellId: string };
};

export interface LocationCellViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface OwnerIncidentPage {
  items: OwnerIncident[];
  nextCursor: string | null;
}
