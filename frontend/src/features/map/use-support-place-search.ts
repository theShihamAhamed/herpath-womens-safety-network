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
  status: SupportPlaceSearchStatus;
  errorMessage: string | null;
  searchSupportPlaces: () => Promise<void>;
  retrySupportPlaces: () => Promise<void>;
}

/**
 * Holds explicit nearby-search state for later Map marker presentation.
 * It intentionally does not react to camera movement or request location.
 */
export function useSupportPlaceSearch({
  location,
  hasUsableLocation,
}: UseSupportPlaceSearchOptions): UseSupportPlaceSearchResult {
  const [supportPlaces, setSupportPlaces] = useState<SupportPlace[]>([]);
  const [status, setStatus] = useState<SupportPlaceSearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const lastSearchLocation = useRef<UserLocation | null>(null);

  const runSearch = useCallback(async (searchLocation: UserLocation | null, canUseLocation: boolean) => {
    if (inFlight.current) return;
    if (!canUseLocation || !searchLocation) {
      setSupportPlaces([]);
      setErrorMessage(null);
      setStatus('location_unavailable');
      return;
    }

    inFlight.current = true;
    lastSearchLocation.current = searchLocation;
    setStatus('loading');
    setErrorMessage(null);

    try {
      const places = await mapApi.getSupportPlaces(
        searchLocation.latitude,
        searchLocation.longitude,
      );
      setSupportPlaces(places);
      setStatus(places.length === 0 ? 'empty' : 'success');
    } catch {
      setSupportPlaces([]);
      setErrorMessage('Nearby support places are temporarily unavailable.');
      setStatus('unavailable');
    } finally {
      inFlight.current = false;
    }
  }, []);

  const searchSupportPlaces = useCallback(
    async () => runSearch(location, hasUsableLocation),
    [hasUsableLocation, location, runSearch],
  );

  const retrySupportPlaces = useCallback(async () => {
    const searchLocation = lastSearchLocation.current ?? location;
    await runSearch(searchLocation, hasUsableLocation && searchLocation !== null);
  }, [hasUsableLocation, location, runSearch]);

  return { supportPlaces, status, errorMessage, searchSupportPlaces, retrySupportPlaces };
}
