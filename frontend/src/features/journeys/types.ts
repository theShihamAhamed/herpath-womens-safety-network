export type JourneyOutcome = 'SAFE_CONFIRMED' | 'INCIDENT_REPORTED' | 'UNKNOWN';
export type JourneyStatus = 'ACTIVE' | 'COMPLETED';

export interface Coordinate { latitude: number; longitude: number; }
export interface LocationPoint extends Coordinate { address?: string; }
export interface PathPoint extends Coordinate { timestamp: string; }

export interface IncomingRouteParams {
  routeId: string;
  origin: LocationPoint;
  destination: LocationPoint;
  polyline: string;
  distance?: number;
  duration?: number;
  riskScore?: number;
}

export interface Journey {
  _id: string;
  origin: LocationPoint;
  destination: LocationPoint;
  selectedRoute: { polyline: string; distance?: number; duration?: number; riskScore?: number };
  startTime?: string;
  endTime?: string;
  distanceTravelled: number;
  duration: number;
  currentPath: PathPoint[];
  checkIns: PathPoint[];
  deviationDetected: boolean;
  deviationLocation: Coordinate | null;
  outcome: JourneyOutcome | null;
  status: JourneyStatus;
}

export interface JourneyHistoryItem {
  _id: string;
  destination: LocationPoint;
  startTime?: string;
  endTime?: string;
  duration: number;
  distanceTravelled: number;
  outcome: JourneyOutcome | null;
  status: JourneyStatus;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalJourneys: number;
  safeJourneys: number;
  incidentJourneys: number;
  unknownJourneys: number;
  safePercentage: number;
  incidentPercentage: number;
  unknownPercentage: number;
}