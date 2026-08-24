import type { IncidentDocument } from './incident.model.js';
import { deriveLegacyIncidentStatus } from './incident-lifecycle.service.js';
import type {
  GeoJsonPoint,
  GeoJsonPolygon,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
} from './incident.types.js';
import { publicAreaFromCell } from './location-privacy.service.js';

export const PUBLIC_INCIDENT_STATUSES = [
  'PUBLISHED_UNVERIFIED',
  'COMMUNITY_SUPPORTED',
  'MODERATOR_REVIEWED',
  'DISPUTED',
] as const satisfies readonly IncidentStatus[];
export type PublicIncidentStatus = (typeof PUBLIC_INCIDENT_STATUSES)[number];

export interface PublicIncident {
  id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: PublicIncidentStatus;
  occurredAt: string;
  createdAt: string;
  supportCount: number;
  publicLocation: GeoJsonPoint;
  publicArea: GeoJsonPolygon;
}

export interface PublicIncidentReadFilters {
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  occurredFrom?: Date;
  occurredTo?: Date;
}

export interface PublicIncidentViewportRead extends PublicIncidentReadFilters {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface PublicIncidentRadiusRead extends PublicIncidentReadFilters {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export function toPublicIncident(incident: IncidentDocument): PublicIncident {
  const hasLifecycle =
    incident.visibilityState !== undefined &&
    incident.communityState !== undefined &&
    incident.moderationState !== undefined &&
    incident.lifecycleRevision !== undefined;
  const isLegacyIncident =
    incident.visibilityState === undefined &&
    incident.communityState === undefined &&
    incident.moderationState === undefined &&
    incident.lifecycleRevision === undefined;

  if (hasLifecycle && incident.visibilityState !== 'PUBLIC') {
    throw new Error('Incident visibility is not eligible for public projection');
  }
  if (!hasLifecycle && !(isLegacyIncident && incident.status === 'PUBLISHED_UNVERIFIED')) {
    throw new Error('Incident lifecycle is not eligible for public projection');
  }

  const status = hasLifecycle
    ? deriveLegacyIncidentStatus({
        visibilityState: incident.visibilityState,
        communityState: incident.communityState,
        moderationState: incident.moderationState,
      })
    : incident.status;

  if (!PUBLIC_INCIDENT_STATUSES.some((publicStatus) => publicStatus === status)) {
    throw new Error('Incident status is not eligible for public projection');
  }

  return {
    id: incident._id.toString(),
    category: incident.category,
    severity: incident.severity,
    status: status as PublicIncidentStatus,
    occurredAt: incident.occurredAt.toISOString(),
    createdAt: incident.createdAt.toISOString(),
    supportCount: incident.supportCount,
    publicLocation: {
      type: 'Point',
      coordinates: [
        incident.publicLocation.coordinates[0],
        incident.publicLocation.coordinates[1],
      ],
    },
    publicArea: publicAreaFromCell(incident.publicCellId),
  };
}
