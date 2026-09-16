import { apiRequest } from '@/src/services/api/client';
import { apiEndpoints } from '@/src/services/api/endpoints';

import { Destination, DestinationSuggestion } from './types';

export async function searchDestinations(
  query: string,
  sessionToken: string,
  userLocation?: { latitude: number; longitude: number } | null,
): Promise<DestinationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) {
    return [];
  }

  let endpoint = `${apiEndpoints.routes.search}?q=${encodeURIComponent(trimmed)}&sessionToken=${encodeURIComponent(sessionToken)}`;
  if (userLocation) {
    endpoint += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
  }

  return apiRequest<DestinationSuggestion[]>(endpoint);
}

export function resolveDestination(placeId: string, sessionToken: string): Promise<Destination> {
  return apiRequest<Destination>(`${apiEndpoints.routes.details}?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`);
}
