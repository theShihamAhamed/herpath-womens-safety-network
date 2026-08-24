// backend/src/modules/routes/routeRisk.service.ts

import { decodePolyline, downsamplePoints } from '../../common/utils/polyline.js';
import type { RouteSummary, RouteWithRiskContext } from './routes.types.js';
import { IncidentModel } from '../incidents/incident.model.js';

const CORRIDOR_RADIUS_METERS = 150;
const SAMPLE_POINTS_PER_ROUTE = 15;
const EARTH_RADIUS_METERS = 6_378_100;


async function countNearbyIncidents(lat: number, lng: number): Promise<number> {
  return IncidentModel.countDocuments({
    publicLocation: {
      $geoWithin: {
        $centerSphere: [
          [lng, lat],
          CORRIDOR_RADIUS_METERS / EARTH_RADIUS_METERS,
        ],
      },
    },
    status: 'PUBLISHED_UNVERIFIED',
  });
}

export async function prepareRoutesForRiskEvaluation(
  routes: RouteSummary[]
): Promise<RouteWithRiskContext[]> {
  return Promise.all(
    routes.map(async (route) => {
      const decoded = decodePolyline(route.polyline);
      const sampledPoints = downsamplePoints(decoded, SAMPLE_POINTS_PER_ROUTE);

      const incidentCounts = await Promise.all(
        sampledPoints.map((p) => countNearbyIncidents(p.lat, p.lng))
      );
      const nearbyIncidentCount = incidentCounts.reduce((a, b) => a + b, 0);

      const withRiskContext: RouteWithRiskContext = {
        ...route,
        sampledPoints,
        corridorRadiusMeters: CORRIDOR_RADIUS_METERS,
        nearbyIncidentCount,
        riskEvaluationStatus: 'ready_for_evaluation',
      };
      return withRiskContext;
    })
  );
}
