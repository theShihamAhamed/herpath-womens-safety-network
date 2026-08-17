import { useEffect, useState } from 'react';
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
}

/** Default fallback region center: Colombo, Sri Lanka. */
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

  useEffect(() => {
    let cancelled = false;

    async function requestLocation(): Promise<void> {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (cancelled) return;
        setPermissionStatus(status);

        if (status !== Location.PermissionStatus.GRANTED) {
          setLocation(FALLBACK_LOCATION);
          setIsLoading(false);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (cancelled) return;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Could not determine your location.',
        );
        setLocation(FALLBACK_LOCATION);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void requestLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, permissionStatus, isLoading, error };
}
