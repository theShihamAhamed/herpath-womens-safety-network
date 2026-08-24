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
