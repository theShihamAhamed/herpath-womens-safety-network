import { apiRequest } from '@/src/services/api/client';
import { apiEndpoints } from '@/src/services/api/endpoints';

import { Destination } from './types';

export async function searchDestinations(
  query: string,
  userLocation?: { latitude: number; longitude: number } | null,
): Promise<Destination[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  let endpoint = `${apiEndpoints.routes.search}?q=${encodeURIComponent(trimmed)}`;
  if (userLocation) {
    endpoint += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
  }

  return apiRequest<Destination[]>(endpoint);
}