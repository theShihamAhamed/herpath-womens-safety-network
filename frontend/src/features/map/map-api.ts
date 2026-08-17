import { apiRequest } from '@/src/services/api/client';

import type { AreaSummary, MapFilter, PublicIncidentMarker, ViewportBounds } from './map.types';

export const mapApi = {
  async getIncidents(bounds: ViewportBounds, filter?: MapFilter): Promise<PublicIncidentMarker[]> {
    const params = new URLSearchParams({
      swLat: bounds.swLat.toString(),
      swLng: bounds.swLng.toString(),
      neLat: bounds.neLat.toString(),
      neLng: bounds.neLng.toString(),
    });

    if (filter?.category && filter.category !== 'ALL') {
      params.append('category', filter.category);
    }
    if (filter?.severity && filter.severity !== 'ALL') params.append('severity', filter.severity);

    const now = new Date();
    const days = filter?.dateRange === '24h' ? 1 : filter?.dateRange === '7d' ? 7 : filter?.dateRange === '30d' ? 30 : 0;
    if (days) {
      const dateFrom = new Date(now);
      dateFrom.setDate(now.getDate() - days);
      params.append('dateFrom', dateFrom.toISOString().slice(0, 10));
      params.append('dateTo', now.toISOString().slice(0, 10));
    }
    if (filter?.timeOfDay === 'daytime') {
      params.append('startHour', '6');
      params.append('endHour', '17');
    } else if (filter?.timeOfDay === 'nighttime') {
      params.append('startHour', '18');
      params.append('endHour', '5');
    }

    return apiRequest<PublicIncidentMarker[]>(`/map/incidents?${params.toString()}`);
  },

  async getAreaSummary(lat: number, lng: number, radiusMeters = 1000): Promise<AreaSummary> {
    return apiRequest<AreaSummary>(
      `/map/area-summary?lat=${lat}&lng=${lng}&radius=${radiusMeters}`
    );
  },
};
