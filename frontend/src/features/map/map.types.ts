/** Incident categories aligned with the domain contract. */
export const INCIDENT_CATEGORIES = [
  'HARASSMENT',
  'THEFT',
  'ASSAULT',
  'STALKING',
  'OTHER',
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

/** Severity levels for incident reports. */
export const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

/** Incident statuses from the domain rules (docs/04-domain-rules.md). */
export const INCIDENT_STATUSES = [
  'PENDING',
  'PUBLISHED_UNVERIFIED',
  'COMMUNITY_SUPPORTED',
  'MODERATOR_REVIEWED',
  'DISPUTED',
  'REJECTED',
  'ARCHIVED',
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/**
 * Public incident marker — only contains approximate/public coordinates.
 * Private/original coordinates are NEVER included (privacy rule).
 */
export interface PublicIncidentMarker {
  id: string;
  category: IncidentCategory;
  severity: SeverityLevel;
  status: IncidentStatus;
  publicLocation: {
    type: 'Point';
    coordinates: [longitude: number, latitude: number];
  };
  createdAt: string;
  supportCount: number;
}

/** Viewport bounding box for querying incidents. */
export interface ViewportBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

/** Filter state for the map. */
export interface MapFilter {
  category: IncidentCategory | 'ALL';
  severity: SeverityLevel | 'ALL';
  dateRange: DateRange;
  timeOfDay: TimeOfDay;
}

export type DateRange = '24h' | '7d' | '30d' | 'all';
export type TimeOfDay = 'all' | 'daytime' | 'nighttime';

/** Category display configuration. */
export const CATEGORY_CONFIG: Record<
  IncidentCategory,
  { label: string; color: string; icon: string }
> = {
  HARASSMENT: { label: 'Harassment', color: '#E74C3C', icon: 'warning' },
  THEFT: { label: 'Theft', color: '#E67E22', icon: 'remove-circle' },
  ASSAULT: { label: 'Assault', color: '#C0392B', icon: 'dangerous' },
  STALKING: { label: 'Stalking', color: '#8E44AD', icon: 'visibility' },
  OTHER: { label: 'Other', color: '#7F8C8D', icon: 'info' },
} as const;

/** Severity display configuration. */
export const SEVERITY_CONFIG: Record<
  SeverityLevel,
  { label: string; color: string }
> = {
  LOW: { label: 'Low', color: '#27AE60' },
  MEDIUM: { label: 'Medium', color: '#F39C12' },
  HIGH: { label: 'High', color: '#E74C3C' },
  CRITICAL: { label: 'Critical', color: '#C0392B' },
} as const;

/** Area summary returned by the area summary endpoint. */
export interface AreaSummary {
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  totalIncidents: number;
  byCategory: Record<IncidentCategory, number>;
  bySeverity: Record<SeverityLevel, number>;
  recentCount: number;
  dataDisclaimer: string;
}
