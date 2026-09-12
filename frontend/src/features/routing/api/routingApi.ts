// frontend/src/features/routing/api/routingApi.ts

import { apiClient } from '../../../services/api/apiClient';
import type { LatLng, RouteAlternativesApiResponse } from '../types/routing.types';

export async function fetchRouteAlternatives(
  origin: LatLng,
  destination: LatLng,
  mode: 'walking' | 'driving' | 'bicycling' = 'walking'
) {
  const { data } = await apiClient.get<RouteAlternativesApiResponse>(
    '/api/routes/alternatives',
    {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode,
      },
    }
  );
  return data.data; // { count, routes }
}
