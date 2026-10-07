import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { LOCATION_UPDATE_INTERVAL_MS, LOCATION_UPDATE_DISTANCE_M } from '../../../config/journeyConstants';

export function useLocationTracking(onLocation: (coords: { latitude: number; longitude: number }) => void) {
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const startPromise = useRef<Promise<boolean> | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const onLocationRef = useRef(onLocation);

  useEffect(() => {
    onLocationRef.current = onLocation;
  }, [onLocation]);

  const start = useCallback((): Promise<boolean> => {
    if (subscription.current) return Promise.resolve(true);
    if (startPromise.current) return startPromise.current;

    const activeGeneration = generation.current + 1;
    generation.current = activeGeneration;
    setError(null);

    const pendingStart = (async () => {
      try {
        const nextSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: LOCATION_UPDATE_INTERVAL_MS,
            distanceInterval: LOCATION_UPDATE_DISTANCE_M,
          },
          (location) => {
            if (generation.current !== activeGeneration) return;
            onLocationRef.current({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          },
        );

        if (!mounted.current || generation.current !== activeGeneration) {
          nextSubscription.remove();
          return false;
        }

        subscription.current = nextSubscription;
        setTracking(true);
        return true;
      } catch (startError) {
        if (mounted.current && generation.current === activeGeneration) {
          setError(
            startError instanceof Error
              ? startError.message
              : 'Location tracking could not be started.',
          );
        }
        return false;
      } finally {
        startPromise.current = null;
      }
    })();

    startPromise.current = pendingStart;
    return pendingStart;
  }, []);

  const stop = useCallback(() => {
    generation.current += 1;
    subscription.current?.remove();
    subscription.current = null;
    setTracking(false);
  }, []);

  useEffect(() => () => {
    mounted.current = false;
    generation.current += 1;
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  return { tracking, error, start, stop };
}
