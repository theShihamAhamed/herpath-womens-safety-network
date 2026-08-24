// backend/src/modules/routes/routeRisk.service.ts

import { decodePolyline, downsamplePoints } from '../../common/utils/polyline.js';
import {
  IncidentPublicReader,
  type PublicIncidentReader,
} from '../incidents/incident.public-reader.js';
import type { RouteSummary, RouteWithRiskContext } from './routes.types.js';

const CORRIDOR_RADIUS_METERS = 150;
const SAMPLE_POINTS_PER_ROUTE = 15;

async function countNearbyIncidents(
  lat: number,
  lng: number,
  incidents: PublicIncidentReader,
): Promise<number> {
  return (
    await incidents.findWithinRadius({
      latitude: lat,
      longitude: lng,
      radiusMeters: CORRIDOR_RADIUS_METERS,
    })
  ).length;
}

export async function prepareRoutesForRiskEvaluation(
  routes: RouteSummary[],
  incidents: PublicIncidentReader = new IncidentPublicReader(),
): Promise<RouteWithRiskContext[]> {
  return Promise.all(
    routes.map(async (route) => {
      const decoded = decodePolyline(route.polyline);
      const sampledPoints = downsamplePoints(decoded, SAMPLE_POINTS_PER_ROUTE);

      const incidentCounts = await Promise.all(
<<<<<<< HEAD
        sampledPoints.map((p) =>
          countNearbyIncidents(p.lat, p.lng, incidents),
        ),
=======
        sampledPoints.map((p) => countNearbyIncidents(p.lat, p.lng, incidents))
>>>>>>> origin/develop
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
    }),
  );
}