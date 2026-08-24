export interface LatLng {
	lat: number;
	lng: number;
}

export interface RouteSummary {
	routeId: string;
	summaryLabel: string;
	distanceMeters: number;
	distanceText: string;
	durationSeconds: number;
	durationText: string;
	polyline: string;
}

export interface RouteWithRiskContext extends RouteSummary {
	sampledPoints: LatLng[];
	corridorRadiusMeters: number;
	nearbyIncidentCount: number;
	riskEvaluationStatus: 'ready_for_evaluation';
}

export interface RouteAlternativesApiResponse {
	success: true;
	data: {
		count: number;
		routes: RouteWithRiskContext[];
	};
}

export interface RouteWithRiskContext {
  routeId: string;
  summaryLabel: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  polyline: string;
  sampledPoints: LatLng[];
  corridorRadiusMeters: number;
  nearbyIncidentCount: number;
  riskEvaluationStatus: 'ready_for_evaluation';
}

export interface RiskFactors {
  incidentCount: number;
  severityWeightedScore: number;
  recencyWeightedScore: number;
}

export interface RouteRiskScore extends RouteWithRiskContext {
  riskScore: number; // lower = safer
  riskFactors: RiskFactors;
}

export interface RouteRecommendation {
  recommendedRouteId: string;
  routes: RouteRiskScore[]; // sorted safest-first
  explanation: string;
}

export interface RouteRecommendationApiResponse {
  success: boolean;
  data: RouteRecommendation;
}
