import {
  IncidentPublicReader,
  type PublicIncidentReader,
} from '../incidents/incident.public-reader.js';
import type { AreaSummaryQuery, PublicIncidentProjection, ViewportQuery } from './map.types.js';

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

export class MapService {
  public constructor(private readonly incidents: PublicIncidentReader = new IncidentPublicReader()) {}

  /**
   * Fetches public incident projections within a bounding box.
   * STRICT PRIVACY RULE: Never returns private coordinates.
   */
  public async getPublicIncidentsInViewport(
    query: ViewportQuery,
  ): Promise<PublicIncidentProjection[]> {
    return this.incidents.findInViewport({
      south: query.swLat,
      west: query.swLng,
      north: query.neLat,
      east: query.neLng,
      ...(query.category === undefined ? {} : { category: query.category }),
      ...(query.severity === undefined ? {} : { severity: query.severity }),
      ...(query.occurredFrom === undefined ? {} : { occurredFrom: query.occurredFrom }),
      ...(query.occurredTo === undefined ? {} : { occurredTo: query.occurredTo }),
    });
  }

  /**
   * Computes aggregated safety context statistics around a central point.
   */
  public async getAreaSummary(query: AreaSummaryQuery) {
    const incidents = await this.incidents.findWithinRadius({
      latitude: query.lat,
      longitude: query.lng,
      radiusMeters: query.radius,
      ...(query.occurredFrom === undefined ? {} : { occurredFrom: query.occurredFrom }),
      ...(query.occurredTo === undefined ? {} : { occurredTo: query.occurredTo }),
    });
    const recentThreshold = Date.now() - RECENT_WINDOW_MS;
    const byCategory = {
      HARASSMENT: 0,
      THEFT: 0,
      ASSAULT: 0,
      STALKING: 0,
      OTHER: 0,
    };
    const bySeverity = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    let recentCount = 0;

    for (const incident of incidents) {
      byCategory[incident.category] += 1;
      bySeverity[incident.severity] += 1;
      if (new Date(incident.occurredAt).getTime() >= recentThreshold) recentCount += 1;
    }

    return {
      center: { latitude: query.lat, longitude: query.lng },
      radiusMeters: query.radius,
      totalIncidents: incidents.length,
      byCategory,
      bySeverity,
      recentCount,
      dataDisclaimer: 'Based on available community data',
    };
  }
}
