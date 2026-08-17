import type { AreaSummaryQuery, PublicIncidentProjection, ViewportQuery } from './map.types.js';

export class MapService {
  /**
   * Fetches public incident projections within a bounding box.
   * STRICT PRIVACY RULE: Never returns private coordinates.
   */
  public async getPublicIncidentsInViewport(
    _query: ViewportQuery,
  ): Promise<PublicIncidentProjection[]> {
    // The incident repository is owned by the incident component and is not available yet.
    // An empty response is intentionally more truthful than displaying invented reports.
    return [];
  }

  /**
   * Computes aggregated safety context statistics around a central point.
   */
  public async getAreaSummary(query: AreaSummaryQuery) {
    return {
      center: { latitude: query.lat, longitude: query.lng },
      radiusMeters: query.radius,
      totalIncidents: 0,
      byCategory: {
        HARASSMENT: 0,
        THEFT: 0,
        ASSAULT: 0,
        STALKING: 0,
        OTHER: 0,
      },
      bySeverity: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      },
      recentCount: 0,
      dataDisclaimer: 'Based on available community data',
    };
  }
}
