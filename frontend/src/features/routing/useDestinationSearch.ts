import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/src/services/api/errors';

import { searchDestinations } from './routing.api';
import { Destination } from './types';

interface UseDestinationSearchOptions {
  userLocation?: { latitude: number; longitude: number } | null;
}

interface UseDestinationSearchResult {
  query: string;
  setQuery: (text: string) => void;
  results: Destination[];
  loading: boolean;
  errorMessage: string | null;
  clearSearch: () => void;
}

export function useDestinationSearch(options: UseDestinationSearchOptions = {}): UseDestinationSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setErrorMessage(null);
    setLoading(false);
  };

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchDestinations(trimmed, options.userLocation);
        setResults(data);
      } catch (error) {
        setResults([]);
        setErrorMessage(error instanceof ApiError ? error.message : 'Unable to find destinations. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, options.userLocation?.latitude, options.userLocation?.longitude]);

  return { query, setQuery, results, loading, errorMessage, clearSearch };
}