import { useCallback, useRef, useState } from 'react';

import { mapApi } from './map-api';
import type { SupportPlace } from './map.types';
import type { UserLocation } from './use-user-location';

export type SupportPlaceSearchStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'unavailable'
  | 'location_unavailable';

interface UseSupportPlaceSearchOptions {
  location: UserLocation | null;
  hasUsableLocation: boolean;
}

interface UseSupportPlaceSearchResult {
  supportPlaces: SupportPlace[];
  searchOrigin: UserLocation | null;
  status: SupportPlaceSearchStatus;
  errorMessage: string | null;
  searchSupportPlaces: (searchLocation?: UserLocation | null) => Promise<void>;
  retrySupportPlaces: () => Promise<void>;
  dismissSupportPlaces: () => void;
}

/**
 * Holds explicit nearby-search state for Map marker presentation.
 * It intentionally does not react to camera movement or request location.
 */
export function useSupportPlaceSearch({
  location,
  hasUsableLocation,
}: UseSupportPlaceSearchOptions): UseSupportPlaceSearchResult {
  const [supportPlaces, setSupportPlaces] = useState<SupportPlace[]>([]);
  const [searchOrigin, setSearchOrigin] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<SupportPlaceSearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastSearchLocation = useRef<UserLocation | null>(null);
  const latestRequestId = useRef(0);

  const runSearch = useCallback(async (searchLocation: UserLocation | null, canUseLocation: boolean) => {
    if (!canUseLocation || !searchLocation) {
      latestRequestId.current += 1;
      setSupportPlaces([]);
      setSearchOrigin(null);
      setErrorMessage(null);
      setStatus('location_unavailable');
      return;
    }

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    const origin = { latitude: searchLocation.latitude, longitude: searchLocation.longitude };
    lastSearchLocation.current = origin;
    setSearchOrigin(origin);
    setStatus('loading');
    setErrorMessage(null);

    try {
      const places = await mapApi.getSupportPlaces(
        origin.latitude,
        origin.longitude,
      );
      if (requestId !== latestRequestId.current) return;
      setSupportPlaces(places);
      setStatus(places.length === 0 ? 'empty' : 'success');
    } catch (error) {
      if (requestId !== latestRequestId.current) return;
      if (isAbortError(error)) {
        setStatus('idle');
        return;
      }
      setSupportPlaces([]);
      setErrorMessage('Nearby support places are temporarily unavailable.');
      setStatus('unavailable');
    }
  }, []);

  const searchSupportPlaces = useCallback(
    async (searchLocation = location) => runSearch(searchLocation, searchLocation !== null),
    [location, runSearch],
  );

  const retrySupportPlaces = useCallback(async () => {
    const searchLocation = lastSearchLocation.current ?? location;
    await runSearch(searchLocation, hasUsableLocation && searchLocation !== null);
  }, [hasUsableLocation, location, runSearch]);

  const dismissSupportPlaces = useCallback(() => {
    latestRequestId.current += 1;
    lastSearchLocation.current = null;
    setSupportPlaces([]);
    setSearchOrigin(null);
    setErrorMessage(null);
    setStatus('idle');
  }, []);

  return {
    supportPlaces,
    searchOrigin,
    status,
    errorMessage,
    searchSupportPlaces,
    retrySupportPlaces,
    dismissSupportPlaces,
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}
