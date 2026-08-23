// backend/src/modules/routes/routeRisk.service.ts
// HS-122: Prepare route data for risk evaluation
//
// This does NOT compute a final risk score — that's a separate, deterministic
// evaluation step per docs/04-domain-rules.md. Here we only:
//   1. Decode each route's polyline into lat/lng points
//   2. Downsample to a manageable number of sample points
//   3. Run a preview geospatial query around each sample point
//   4. Attach that context to the route for the next step to score

import { decodePolyline, downsamplePoints } from '../../common/utils/polyline.js';
import type { RouteSummary, RouteWithRiskContext } from './routes.types.js';
import { IncidentModel } from '../incidents/incident.model.js';

const CORRIDOR_RADIUS_METERS = 150;
const SAMPLE_POINTS_PER_ROUTE = 15;

/**
 * Assumes backend/src/modules/incidents has an Incident model with a
 * `publicLocation` GeoJSON Point field (2dsphere indexed), per
 * docs/07-security-privacy.md's public/private location split. Update this
 * import path to match the real export from the incidents module:
 *
 *   import { Incident } from '../incidents/incident.model';
 */
async function countNearbyIncidents(lat: number, lng: number): Promise<number> {
  return IncidentModel.countDocuments({
    publicLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: CORRIDOR_RADIUS_METERS,
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
