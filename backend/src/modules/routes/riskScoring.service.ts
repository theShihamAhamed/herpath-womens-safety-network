// backend/src/modules/routes/riskScoring.service.ts
// HS-88: Select lower-risk route (scoring engine that makes selection possible)
//
// Deterministic, not ML-based — per docs/04-domain-rules.md, route-risk
// evaluation must be deterministic and based on available incident data.

import {
  IncidentPublicReader,
  type PublicIncidentReader,
} from '../incidents/incident.public-reader.js';
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

// If severity is stored as a string enum in your Incident model, use this
// instead of the raw numeric field:
const SEVERITY_MAP: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 4,
  critical: 5,
};

function toSeverityNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return SEVERITY_MAP[raw.toLowerCase()] ?? 2;
  return 2; // safe default if missing
}

/**
 * Fetches nearby *approved* incidents (with severity + occurredAt) around a
 * route's sampled points, deduplicated across points.
 */
async function fetchNearbyIncidentDetails(
  sampledPoints: LatLng[],
  radiusMeters: number,
  reader: PublicIncidentReader,
): Promise<IncidentSample[]> {
  const seen = new Map<string, IncidentSample>();

  await Promise.all(
    sampledPoints.map(async (point) => {
      const docs = await reader.findWithinRadius({
        latitude: point.lat,
        longitude: point.lng,
        radiusMeters,
      });

      for (const doc of docs) {
        const id = doc.id;
        if (!seen.has(id)) {
          seen.set(id, {
            id,
            severity: toSeverityNumber(doc.severity),
            occurredAt: doc.occurredAt,
          });
        }
      }
    })
  );

  return Array.from(seen.values());
}

/** Recency weight: recent incidents count more, decaying toward 0 over time. */
function recencyWeight(occurredAt: string): number {
  const daysSince = (Date.now() - new Date(occurredAt).getTime()) / (1000 * 60 * 60 * 24);
  if (Number.isNaN(daysSince) || daysSince < 0) return 1;
  return Math.exp(-daysSince / 30); // ~37% weight at 30 days, ~14% at 60 days
}

/** Severity weight: normalized 0..1 against a 5-point scale. */
function severityWeight(severity: number): number {
  return Math.min(Math.max(severity, 1), 5) / 5;
}

/**
 * Computes a deterministic, per-km-normalized risk score for one route.
 */
export async function scoreRouteRisk(
  route: RouteWithRiskContext,
  reader: PublicIncidentReader = new IncidentPublicReader(),
): Promise<RouteRiskScore> {
  const incidents = await fetchNearbyIncidentDetails(
    route.sampledPoints,
    route.corridorRadiusMeters,
    reader,
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
  routes: RouteWithRiskContext[],
  reader: PublicIncidentReader = new IncidentPublicReader(),
): Promise<RouteRiskScore[]> {
  return Promise.all(routes.map((route) => scoreRouteRisk(route, reader)));
}
