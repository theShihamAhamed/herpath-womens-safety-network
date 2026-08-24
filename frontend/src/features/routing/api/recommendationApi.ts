// frontend/src/features/routing/api/recommendationApi.ts

import { apiClient } from '../../../services/apiClient';
import type { LatLng, RouteRecommendationApiResponse } from '../types/routing.types';

export async function fetchRouteRecommendation(
  origin: LatLng,
  destination: LatLng,
  mode: 'walking' | 'driving' | 'bicycling' = 'walking'
) {
  const { data } = await apiClient.get<RouteRecommendationApiResponse>(
    '/api/v1/routes/recommendation',
    {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode,
      },
    }
  );
  return data.data; // { recommendedRouteId, routes, explanation }
}
