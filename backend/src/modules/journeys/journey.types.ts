export type JourneyOutcome = 'SAFE_CONFIRMED' | 'INCIDENT_REPORTED' | 'UNKNOWN';
export type JourneyStatus = 'ACTIVE' | 'COMPLETED';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface LocationPoint extends Coordinate {
  address?: string;
}

export interface StartJourneyInput {
  routeId: string;
  origin: LocationPoint;
  destination: LocationPoint;
  polyline: string;
  distance?: number;
  duration?: number;
  riskScore?: number;
}