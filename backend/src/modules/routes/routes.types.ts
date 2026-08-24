export interface Destination {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface DestinationSearchQuery {
  q: string;
  lat?: number | undefined;
  lng?: number | undefined;
}


export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteAlternativesRequest {
  origin: LatLng;
  destination: LatLng;
  mode?: 'walking' | 'driving' | 'bicycling'; // default: walking
}

export interface RoutingRawRoute {
  summary: string;
  overview_polyline: { points: string };
  legs: Array<{
    distance: { text: string; value: number }; // meters
    duration: { text: string; value: number }; // seconds
    start_location: { lat: number; lng: number };
    end_location: { lat: number; lng: number };
  }>;
  warnings: string[];
}

// Display-ready route summary
export interface RouteSummary {
  routeId: string;
  summaryLabel: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  polyline: string; // encoded polyline, for the map module to render
}


export interface RouteWithRiskContext extends RouteSummary {
  sampledPoints: LatLng[];
  corridorRadiusMeters: number;
  nearbyIncidentCount: number; // preview count only — not a final risk score
  riskEvaluationStatus: 'ready_for_evaluation';
}
