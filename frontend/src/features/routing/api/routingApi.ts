// frontend/src/features/routing/api/routingApi.ts

import { apiRequest } from '../../../services/api/client';
import { apiEndpoints } from '../../../services/api/endpoints';
import type { LatLng, RouteAlternativesApiResponse } from '../types/routing.types';

export async function fetchRouteAlternatives(
  origin: LatLng,
  destination: LatLng,
  mode: 'walking' | 'driving' | 'bicycling' = 'walking'
) {
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode,
  });
  return apiRequest<RouteAlternativesApiResponse['data']>(
    `${apiEndpoints.routes.alternatives}?${params.toString()}`,
  );
}
