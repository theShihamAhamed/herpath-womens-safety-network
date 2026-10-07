// frontend/src/features/routing/api/recommendationApi.ts

import { apiRequest } from '../../../services/api/client';
import { apiEndpoints } from '../../../services/api/endpoints';
import type { LatLng, RouteRecommendationApiResponse } from '../types/routing.types';

export async function fetchRouteRecommendation(
  origin: LatLng,
  destination: LatLng,
  mode: 'walking' | 'driving' | 'bicycling' = 'walking'
) {
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode,
  });
  return apiRequest<RouteRecommendationApiResponse['data']>(
    `${apiEndpoints.routes.recommendation}?${params.toString()}`,
  );
}
