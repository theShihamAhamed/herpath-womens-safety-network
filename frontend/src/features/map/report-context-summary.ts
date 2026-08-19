import type { IncidentCategory, PublicIncidentMarker } from './map.types';

export interface VisibleIncidentSummary {
  total: number;
  highSeverityCount: number;
  byCategory: Partial<Record<IncidentCategory, number>>;
}

export function summarizeVisibleIncidents(
  incidents: PublicIncidentMarker[],
): VisibleIncidentSummary {
  const byCategory: Partial<Record<IncidentCategory, number>> = {};
  let highSeverityCount = 0;

  for (const incident of incidents) {
    byCategory[incident.category] = (byCategory[incident.category] ?? 0) + 1;
    if (incident.severity === 'HIGH' || incident.severity === 'CRITICAL') highSeverityCount += 1;
  }

  return { total: incidents.length, highSeverityCount, byCategory };
}
