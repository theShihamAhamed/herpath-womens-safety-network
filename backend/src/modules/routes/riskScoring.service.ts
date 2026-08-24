// backend/src/modules/routes/riskScoring.service.ts

import { IncidentModel } from '../incidents/incident.model.js';
import type { LatLng, RouteWithRiskContext } from './routes.types.js';

export interface IncidentSample {
  id: string;
  severity: number; // 1 (low) .. 5 (critical)
  occurredAt: string; // ISO date string
}

export interface RiskFactors {
  incidentCount: number;
  severityWeightedScore: number;
  recencyWeightedScore: number;
}

export interface RouteRiskScore extends RouteWithRiskContext {
  riskScore: number; // lower = safer. Normalized per km so longer routes
                      // aren't unfairly penalized just for covering more ground.
  riskFactors: RiskFactors;
}


const SEVERITY_MAP: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 4,
  critical: 5,
};
const EARTH_RADIUS_METERS = 6_378_100;

function toSeverityNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return SEVERITY_MAP[raw.toLowerCase()] ?? 2;
  return 2; // safe default if missing
}

async function fetchNearbyIncidentDetails(
  sampledPoints: LatLng[],
  radiusMeters: number
): Promise<IncidentSample[]> {
  const seen = new Map<string, IncidentSample>();

  await Promise.all(
    sampledPoints.map(async (point) => {
      const docs = await IncidentModel.find({
        publicLocation: {
          $geoWithin: {
            $centerSphere: [
              [point.lng, point.lat],
              radiusMeters / EARTH_RADIUS_METERS,
            ],
          },
        },
        status: { $in: ['PUBLISHED_UNVERIFIED', 'COMMUNITY_SUPPORTED', 'MODERATOR_REVIEWED'] },
      })
        .select('_id severity occurredAt')
        .lean();

      for (const doc of docs) {
        const id = String(doc._id);
        if (!seen.has(id)) {
          const occurredAtIso = doc.occurredAt instanceof Date ? doc.occurredAt.toISOString() : String(doc.occurredAt);
          seen.set(id, {
            id,
            severity: toSeverityNumber(doc.severity),
            occurredAt: occurredAtIso,
          });
        }
      }
    })
  );

  return Array.from(seen.values());
}

function recencyWeight(occurredAt: string): number {
  const daysSince = (Date.now() - new Date(occurredAt).getTime()) / (1000 * 60 * 60 * 24);
  if (Number.isNaN(daysSince) || daysSince < 0) return 1;
  return Math.exp(-daysSince / 30); // ~37% weight at 30 days, ~14% at 60 days
}


function severityWeight(severity: number): number {
  return Math.min(Math.max(severity, 1), 5) / 5;
}


export async function scoreRouteRisk(
  route: RouteWithRiskContext
): Promise<RouteRiskScore> {
  const incidents = await fetchNearbyIncidentDetails(
    route.sampledPoints,
    route.corridorRadiusMeters
  );

  let severityWeightedScore = 0;
  let recencyWeightedScore = 0;

  for (const incident of incidents) {
    const sw = severityWeight(incident.severity);
    const rw = recencyWeight(incident.occurredAt);
    severityWeightedScore += sw;
    recencyWeightedScore += sw * rw;
  }

  const distanceKm = Math.max(route.distanceMeters / 1000, 0.1); // avoid /0 on very short routes
  const riskScore = recencyWeightedScore / distanceKm;

  return {
    ...route,
    riskScore,
    riskFactors: {
      incidentCount: incidents.length,
      severityWeightedScore,
      recencyWeightedScore,
    },
  };
}

export async function scoreAllRoutes(
  routes: RouteWithRiskContext[]
): Promise<RouteRiskScore[]> {
  return Promise.all(routes.map(scoreRouteRisk));
}
