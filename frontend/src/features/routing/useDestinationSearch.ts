import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/src/services/api/errors';

import { searchDestinations } from './routing.api';
import { DestinationSuggestion } from './types';

interface UseDestinationSearchOptions {
  userLocation?: { latitude: number; longitude: number } | null;
}

interface UseDestinationSearchResult {
  query: string;
  setQuery: (text: string) => void;
  results: DestinationSuggestion[];
  resultsQuery: string | null;
  loading: boolean;
  errorMessage: string | null;
  locationRequired: boolean;
  shortQuery: boolean;
  clearSearch: () => void;
  retrySearch: () => void;
}

export function useDestinationSearch(options: UseDestinationSearchOptions = {}): UseDestinationSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DestinationSuggestion[]>([]);
  const [resultsQuery, setResultsQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationRequired, setLocationRequired] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestRef = useRef(0);
  const userLocation = options.userLocation;

  const clearSearch = useCallback(() => {
    latestRequestRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery('');
    setResults([]);
    setResultsQuery(null);
    setErrorMessage(null);
    setLocationRequired(false);
    setLoading(false);
  }, []);

  const retrySearch = useCallback(() => {
    if (query.trim().length >= 1) setRetryVersion((version) => version + 1);
  }, [query]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    if (trimmed.length < 1) {
      setResults([]);
      setResultsQuery(null);
      setErrorMessage(null);
      setLocationRequired(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setResults([]);
    setResultsQuery(null);
    setErrorMessage(null);
    setLocationRequired(false);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchDestinations(trimmed, userLocation);
        if (latestRequestRef.current === requestId) {
          setResults(data);
          setResultsQuery(trimmed);
        }
      } catch (error) {
        if (latestRequestRef.current === requestId) {
          setResults([]);
          setResultsQuery(null);
          setLocationRequired(error instanceof ApiError && error.code === 'DESTINATION_LOCATION_REQUIRED');
          setErrorMessage(
            error instanceof ApiError && error.code !== 'VALIDATION_ERROR'
              ? error.message
              : 'Destination suggestions are temporarily unavailable. Please try again.',
          );
        }
      } finally {
        if (latestRequestRef.current === requestId) setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, retryVersion, userLocation]);

  const shortQuery = query.trim().length === 1 && results.length === 0 && !loading && !errorMessage;

  return { query, setQuery, results, resultsQuery, loading, errorMessage, locationRequired, shortQuery, clearSearch, retrySearch };
}
