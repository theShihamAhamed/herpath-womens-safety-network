// tests/unit/recommendation.test.ts
// Unit tests for:
//   HS-88: scoreRouteRisk / scoreAllRoutes (risk scoring engine)
//   HS-87: getRouteRecommendation (pick safest route)
//   HS-86: safety explanation text generation

import { beforeEach, describe, expect, it, vi } from 'vitest';

const incidentReaderMocks = vi.hoisted(() => ({
  findInViewport: vi.fn(),
  findWithinRadius: vi.fn(),
}));

vi.mock('../../src/modules/incidents/incident.public-reader.js', () => ({
  IncidentPublicReader: class {
    public findInViewport = incidentReaderMocks.findInViewport;
    public findWithinRadius = incidentReaderMocks.findWithinRadius;
  },
}));

import type { PublicIncident } from '../../src/modules/incidents/incident.public.js';
import {
  scoreAllRoutes,
  scoreRouteRisk,
} from '../../src/modules/routes/riskScoring.service.js';
import { getRouteRecommendation } from '../../src/modules/routes/recommendation.service.js';
import type { RouteWithRiskContext } from '../../src/modules/routes/routes.types.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRoute(overrides: Partial<RouteWithRiskContext> = {}): RouteWithRiskContext {
  return {
    routeId: 'route-1',
    summaryLabel: 'Via Main St',
    distanceMeters: 2000, // 2 km
    distanceText: '2.0 km',
    durationSeconds: 1440,
    durationText: '24 min',
    polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', // stub — not decoded in unit tests
    sampledPoints: [
      { lat: 6.9271, lng: 79.8612 },
      { lat: 6.9250, lng: 79.8600 },
    ],
    corridorRadiusMeters: 150,
    nearbyIncidentCount: 0,
    riskEvaluationStatus: 'ready_for_evaluation',
    ...overrides,
  };
}

function makePublicIncident(opts: {
  id: string;
  severity: PublicIncident['severity'];
  daysAgo: number;
  status?: PublicIncident['status'];
}): PublicIncident {
  return {
    id: opts.id,
    category: 'HARASSMENT',
    severity: opts.severity,
    status: opts.status ?? 'PUBLISHED_UNVERIFIED',
    occurredAt: new Date(Date.now() - opts.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    supportCount: 0,
    publicLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
    publicArea: {
      type: 'Polygon',
      coordinates: [[[79.86, 6.92], [79.87, 6.92], [79.87, 6.93], [79.86, 6.92]]],
    },
  };
}

/** Helper: make the visibility-authoritative public reader return incidents. */
function mockPublicIncidentRead(incidents: PublicIncident[]) {
  incidentReaderMocks.findWithinRadius.mockResolvedValue(incidents);
}

/** Helper: make successive public-reader calls return different incidents. */
function mockPublicIncidentReadSequence(...incidentsPerCall: PublicIncident[][]) {
  let callIndex = 0;
  incidentReaderMocks.findWithinRadius.mockImplementation(() => {
    const incidents = incidentsPerCall[callIndex] ?? [];
    callIndex++;
    return Promise.resolve(incidents);
  });
}

// ─── HS-88: Risk Scoring ──────────────────────────────────────────────────────

describe('HS-88 scoreRouteRisk', () => {
  beforeEach(() => {
    incidentReaderMocks.findWithinRadius.mockReset();
    mockPublicIncidentRead([]);
  });

  it('returns riskScore of 0 and incidentCount 0 for a clean route', async () => {
    const route = makeRoute();
    const scored = await scoreRouteRisk(route);

    expect(scored.riskScore).toBe(0);
    expect(scored.riskFactors.incidentCount).toBe(0);
    expect(scored.riskFactors.severityWeightedScore).toBe(0);
    expect(scored.riskFactors.recencyWeightedScore).toBe(0);
  });

  it('returns riskScore > 0 when nearby incidents are found', async () => {
    mockPublicIncidentRead([makePublicIncident({ id: 'inc-1', severity: 'HIGH', daysAgo: 5 })]);

    const route = makeRoute();
    const scored = await scoreRouteRisk(route);

    expect(scored.riskScore).toBeGreaterThan(0);
    expect(scored.riskFactors.incidentCount).toBe(1);
  });

  it('deduplicates incidents that appear near multiple sampled points', async () => {
    const sharedIncident = makePublicIncident({ id: 'shared-inc', severity: 'MEDIUM', daysAgo: 3 });
    // Every sampled point returns the same incident
    mockPublicIncidentRead([sharedIncident]);

    const route = makeRoute({
      sampledPoints: [
        { lat: 6.9271, lng: 79.8612 },
        { lat: 6.9272, lng: 79.8613 },
        { lat: 6.9273, lng: 79.8614 },
      ],
    });
    const scored = await scoreRouteRisk(route);

    // Despite 3 sampled points all returning the same incident, count should be 1
    expect(scored.riskFactors.incidentCount).toBe(1);
  });

  it('normalizes riskScore per km so shorter routes are not unfairly penalized', async () => {
    const incident = makePublicIncident({ id: 'inc-1', severity: 'HIGH', daysAgo: 5 });
    mockPublicIncidentRead([incident]);

    const shortRoute = makeRoute({ routeId: 'short', distanceMeters: 500 });
    const longRoute = makeRoute({ routeId: 'long', distanceMeters: 5000 });

    const [shortScored, longScored] = await Promise.all([
      scoreRouteRisk(shortRoute),
      scoreRouteRisk(longRoute),
    ]);

    // Same incident but long route covers more distance — its per-km score is lower
    expect(shortScored.riskScore).toBeGreaterThan(longScored.riskScore);
  });

  it('scoreAllRoutes scores every route in the array', async () => {
    mockPublicIncidentRead([]);
    const routes = [
      makeRoute({ routeId: 'r1' }),
      makeRoute({ routeId: 'r2' }),
      makeRoute({ routeId: 'r3' }),
    ];
    const scored = await scoreAllRoutes(routes);

    expect(scored).toHaveLength(3);
    expect(scored.map((s) => s.routeId)).toEqual(['r1', 'r2', 'r3']);
  });
});

// ─── HS-87: Recommendation Generation ────────────────────────────────────────

describe('HS-87 getRouteRecommendation', () => {
  beforeEach(() => {
    incidentReaderMocks.findWithinRadius.mockReset();
    mockPublicIncidentRead([]);
  });

  it('throws when routes array is empty', async () => {
    await expect(getRouteRecommendation([])).rejects.toThrow(
      'No routes available to generate a recommendation from.',
    );
  });

  it('recommends the only route when there is just one', async () => {
    const route = makeRoute({ routeId: 'solo-route' });
    const result = await getRouteRecommendation([route]);

    expect(result.recommendedRouteId).toBe('solo-route');
    expect(result.routes).toHaveLength(1);
  });

  it('recommends the route with the lowest risk score when multiple routes exist', async () => {
    // riskyRoute points all return an incident; safeRoute points return none
    const incident = makePublicIncident({ id: 'inc-1', severity: 'HIGH', daysAgo: 2 });
    // routes are processed in order: riskyRoute (2 points), then safeRoute (2 points)
    mockPublicIncidentReadSequence([incident], [incident], [], []);

    const riskyRoute = makeRoute({ routeId: 'risky', distanceMeters: 2000 });
    const safeRoute = makeRoute({ routeId: 'safe', distanceMeters: 2200 });
    const result = await getRouteRecommendation([riskyRoute, safeRoute]);

    expect(result.recommendedRouteId).toBe('safe');
    expect(result.routes[0]?.routeId).toBe('safe');
    expect(result.routes[1]?.routeId).toBe('risky');
  });

  it('includes all routes in the response sorted by riskScore ascending', async () => {
    mockPublicIncidentRead([]);

    const routes = [
      makeRoute({ routeId: 'r1', distanceMeters: 1000 }),
      makeRoute({ routeId: 'r2', distanceMeters: 2000 }),
      makeRoute({ routeId: 'r3', distanceMeters: 3000 }),
    ];
    const result = await getRouteRecommendation(routes);

    expect(result.routes).toHaveLength(3);
    // All risk scores should be non-decreasing
    for (let i = 1; i < result.routes.length; i++) {
      expect(result.routes[i]!.riskScore).toBeGreaterThanOrEqual(result.routes[i - 1]!.riskScore);
    }
  });
});

// ─── HS-86: Safety Explanation Text ──────────────────────────────────────────

describe('HS-86 safety explanation', () => {
  beforeEach(() => {
    incidentReaderMocks.findWithinRadius.mockReset();
    mockPublicIncidentRead([]);
  });

  it('explains "only route, no incidents" for a single clean route', async () => {
    const route = makeRoute({ routeId: 'only-route' });
    const result = await getRouteRecommendation([route]);

    expect(result.explanation).toMatch(/only route/i);
    expect(result.explanation).toMatch(/no recent safety reports/i);
  });

  it('explains "only route, has N reports" for a single route with incidents', async () => {
    mockPublicIncidentRead([
      makePublicIncident({ id: 'i1', severity: 'LOW', daysAgo: 10 }),
      makePublicIncident({ id: 'i2', severity: 'LOW', daysAgo: 15 }),
    ]);

    const route = makeRoute({ routeId: 'only-risky' });
    const result = await getRouteRecommendation([route]);

    expect(result.explanation).toMatch(/only route/i);
    expect(result.explanation).toMatch(/recent safety report/i);
  });

  it('mentions "fewer recent reports" when winner has fewer incidents than runner-up', async () => {
    // safeRoute: all points return no incidents; riskyRoute: points return 1 distinct incident each
    const i1 = makePublicIncident({ id: 'i1', severity: 'MEDIUM', daysAgo: 5 });
    const i2 = makePublicIncident({ id: 'i2', severity: 'HIGH', daysAgo: 3 });
    mockPublicIncidentReadSequence([], [], [i1], [i2]);

    const safeRoute = makeRoute({ routeId: 'safe' });
    const riskyRoute = makeRoute({ routeId: 'risky' });
    const result = await getRouteRecommendation([safeRoute, riskyRoute]);

    expect(result.explanation).toMatch(/no recent safety reports|fewer recent reports/i);
    expect(result.explanation).toMatch(/not a guarantee/i);
  });

  it('ends explanation with the safety disclaimer', async () => {
    mockPublicIncidentRead([]);
    const routes = [makeRoute({ routeId: 'r1' }), makeRoute({ routeId: 'r2' })];
    const result = await getRouteRecommendation(routes);

    expect(result.explanation).toMatch(/not a guarantee of safety/i);
    expect(result.explanation).toMatch(/please stay alert/i);
  });
});
