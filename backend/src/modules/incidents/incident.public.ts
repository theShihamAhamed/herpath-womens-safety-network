import type { IncidentDocument } from './incident.model.js';
import type {
  GeoJsonPoint,
  GeoJsonPolygon,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
} from './incident.types.js';
import { publicAreaFromCell } from './location-privacy.service.js';

export const PUBLIC_INCIDENT_STATUSES = ['PUBLISHED_UNVERIFIED'] as const satisfies readonly IncidentStatus[];
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
  if (!PUBLIC_INCIDENT_STATUSES.some((status) => status === incident.status)) {
    throw new Error('Incident status is not eligible for public projection');
  }

  return {
    id: incident._id.toString(),
    category: incident.category,
    severity: incident.severity,
    status: incident.status as PublicIncidentStatus,
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
