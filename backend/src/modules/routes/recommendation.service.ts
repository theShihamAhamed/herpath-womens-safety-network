// backend/src/modules/routes/recommendation.service.ts
// HS-87: Generate recommendation (pick the lower-risk route)
// HS-86: Display safety explanation (build the explanation text)
//
// Explanation text is template-based and deterministic — not LLM-generated —
// so it stays consistent with the "safety context, not certainty" philosophy
// and never overclaims.

import { scoreAllRoutes, RouteRiskScore } from './riskScoring.service';
import { RouteWithRiskContext } from './routes.types';

export interface RouteRecommendation {
  recommendedRouteId: string;
  routes: RouteRiskScore[]; // sorted ascending by riskScore (safest first)
  explanation: string;
}

function buildSafetyExplanation(sortedRoutes: RouteRiskScore[]): string {
  const [best, ...rest] = sortedRoutes;
  const nextBest = rest[0];

  if (!nextBest) {
    return best.riskFactors.incidentCount === 0
      ? 'This is the only route available, and it has no recent safety reports nearby.'
      : `This is the only route available. It has ${best.riskFactors.incidentCount} recent safety report(s) nearby — review the map for details before you go.`;
  }

  const parts: string[] = [];

  if (best.riskFactors.incidentCount === 0) {
    parts.push('has no recent safety reports along the way');
  } else if (best.riskFactors.incidentCount < nextBest.riskFactors.incidentCount) {
    parts.push(
      `has fewer recent reports nearby (${best.riskFactors.incidentCount}) than the next option (${nextBest.riskFactors.incidentCount})`
    );
  } else {
    parts.push(
      `has reports that are, on average, older and less severe than the next option`
    );
  }

  if (best.riskFactors.severityWeightedScore < nextBest.riskFactors.severityWeightedScore) {
    parts.push('and the nearby reports tend to be lower-severity');
  }

  const reasonText = parts.join(', ');

  return `This route was recommended because it ${reasonText}. This reflects community-reported context, not a guarantee of safety — please stay alert.`;
}

/**
 * HS-87 + HS-88: scores every route, sorts safest-first, and picks the
 * lowest-risk one as the recommendation.
 * HS-86: attaches a human-readable explanation for why it was picked.
 */
export async function getRouteRecommendation(
  routes: RouteWithRiskContext[]
): Promise<RouteRecommendation> {
  if (routes.length === 0) {
    throw new Error('No routes available to generate a recommendation from.');
  }

  const scoredRoutes = await scoreAllRoutes(routes);
  const sortedRoutes = [...scoredRoutes].sort((a, b) => a.riskScore - b.riskScore);

  return {
    recommendedRouteId: sortedRoutes[0].routeId,
    routes: sortedRoutes,
    explanation: buildSafetyExplanation(sortedRoutes),
  };
}
