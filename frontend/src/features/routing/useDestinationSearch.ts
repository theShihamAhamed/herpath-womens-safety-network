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
  loading: boolean;
  errorMessage: string | null;
  clearSearch: () => void;
  retrySearch: () => void;
}

export function useDestinationSearch(options: UseDestinationSearchOptions = {}): UseDestinationSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DestinationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestRef = useRef(0);
  const userLocation = options.userLocation;

  const clearSearch = useCallback(() => {
    latestRequestRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery('');
    setResults([]);
    setErrorMessage(null);
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
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchDestinations(trimmed, userLocation);
        if (latestRequestRef.current === requestId) setResults(data);
      } catch (error) {
        if (latestRequestRef.current === requestId) {
          setResults([]);
          setErrorMessage(error instanceof ApiError ? error.message : 'Unable to find destinations. Please try again.');
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

  return { query, setQuery, results, loading, errorMessage, clearSearch, retrySearch };
}
