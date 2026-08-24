// frontend/src/features/routing/hooks/useRouteRecommendation.ts

import { useCallback, useState } from 'react';
import { fetchRouteRecommendation } from '../api/recommendationApi';
import { LatLng, RouteRecommendation } from '../types/routing.types';

interface UseRouteRecommendationResult {
  recommendation: RouteRecommendation | null;
  loading: boolean;
  error: string | null;
  requestRecommendation: (origin: LatLng, destination: LatLng) => Promise<void>;
}

export function useRouteRecommendation(): UseRouteRecommendationResult {
  const [recommendation, setRecommendation] = useState<RouteRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestRecommendation = useCallback(
    async (origin: LatLng, destination: LatLng) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchRouteRecommendation(origin, destination);
        setRecommendation(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load a route recommendation.'
        );
        setRecommendation(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { recommendation, loading, error, requestRecommendation };
}
