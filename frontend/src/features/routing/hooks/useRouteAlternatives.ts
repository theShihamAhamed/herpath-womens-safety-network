// frontend/src/features/routing/hooks/useRouteAlternatives.ts

import { useCallback, useState } from 'react';
import { fetchRouteAlternatives } from '../api/routingApi';
import type { LatLng, RouteWithRiskContext } from '../types/routing.types';

interface UseRouteAlternativesResult {
  routes: RouteWithRiskContext[];
  loading: boolean;
  error: string | null;
  requestRoutes: (origin: LatLng, destination: LatLng) => Promise<void>;
}

export function useRouteAlternatives(): UseRouteAlternativesResult {
  const [routes, setRoutes] = useState<RouteWithRiskContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestRoutes = useCallback(async (origin: LatLng, destination: LatLng) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRouteAlternatives(origin, destination);
      setRoutes(result.routes);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load route alternatives.'
      );
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { routes, loading, error, requestRoutes };
}
