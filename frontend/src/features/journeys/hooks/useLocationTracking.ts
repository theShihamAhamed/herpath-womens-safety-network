import { useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { LOCATION_UPDATE_INTERVAL_MS, LOCATION_UPDATE_DISTANCE_M } from '../../../config/journeyConstants';

export function useLocationTracking(onLocation: (coords: { latitude: number; longitude: number }) => void) {
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscription = useRef<Location.LocationSubscription | null>(null);

  const start = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location permission was not granted.');
      return false;
    }
    subscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_UPDATE_INTERVAL_MS,
        distanceInterval: LOCATION_UPDATE_DISTANCE_M,
      },
      (loc) => onLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
    );
    setTracking(true);
    return true;
  }, [onLocation]);

  const stop = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
    setTracking(false);
  }, []);

  return { tracking, error, start, stop };
}