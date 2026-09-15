import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface UseUserLocationResult {
  location: UserLocation | null;
  permissionStatus: Location.PermissionStatus | null;
  isLoading: boolean;
  error: string | null;
  requestLocation: () => Promise<UserLocation | null>;
}

/** Default Map display region: Colombo, Sri Lanka. This is never treated as a user location. */
export const FALLBACK_LOCATION: UserLocation = {
  latitude: 6.9271,
  longitude: 79.8612,
};

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const readCurrentLocation = useCallback(async (): Promise<UserLocation | null> => {
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocation(currentLocation);
      setError(null);
      return currentLocation;
    } catch (err) {
      setLocation(null);
      setError(err instanceof Error ? err.message : 'Could not determine your location.');
      return null;
    }
  }, []);

  const requestLocation = useCallback(async (): Promise<UserLocation | null> => {
    setIsLoading(true);
    try {
      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission = currentPermission.status === Location.PermissionStatus.GRANTED
        ? currentPermission
        : await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(permission.status);

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocation(null);
        setError(null);
        return null;
      }

      return await readCurrentLocation();
    } finally {
      setIsLoading(false);
    }
  }, [readCurrentLocation]);

  useEffect(() => {
    let cancelled = false;

    async function restoreGrantedLocation(): Promise<void> {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        setPermissionStatus(permission.status);
        if (permission.status === Location.PermissionStatus.GRANTED) {
          await readCurrentLocation();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not check location permission.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restoreGrantedLocation();
    return () => { cancelled = true; };
  }, [readCurrentLocation]);

  return { location, permissionStatus, isLoading, error, requestLocation };
}
