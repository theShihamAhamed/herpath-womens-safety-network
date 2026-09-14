import type {
  IncidentCategory,
  IncidentSeverity,
} from '../incidents/incident.types.js';
import type { PublicIncident } from '../incidents/incident.public.js';

export interface ViewportQuery {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  occurredFrom?: Date;
  occurredTo?: Date;
}

export interface AreaSummaryQuery {
  lat: number;
  lng: number;
  radius: number;
  occurredFrom?: Date;
  occurredTo?: Date;
}

export interface SupportPlaceQuery {
  latitude: number;
  longitude: number;
  radius: number;
}

export type PublicIncidentProjection = PublicIncident;
