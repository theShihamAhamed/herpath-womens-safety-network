import { createContext, ReactNode, useContext, useState } from 'react';

import { Destination, DestinationSuggestion, RouteOrigin } from './types';

interface RouteContextValue {
  selectedDestination: Destination | null;
  setSelectedDestination: (destination: Destination | null) => void;
  origin: RouteOrigin | null;
  setOrigin: (origin: RouteOrigin | null) => void;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
  isPlanning: boolean;
  setIsPlanning: (isPlanning: boolean) => void;
  submittedSearchQuery: string | null;
  searchMapResults: DestinationSuggestion[];
  selectedSearchResult: DestinationSuggestion | null;
  submitSearchMapResults: (query: string, results: DestinationSuggestion[]) => void;
  setSelectedSearchResult: (result: DestinationSuggestion | null) => void;
  clearSearchMapResults: () => void;
  clearRoutePlanning: () => void;
}

const RouteContext = createContext<RouteContextValue | undefined>(undefined);

export function RouteProvider({ children }: { children: ReactNode }) {
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [origin, setOrigin] = useState<RouteOrigin | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState<string | null>(null);
  const [searchMapResults, setSearchMapResults] = useState<DestinationSuggestion[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] = useState<DestinationSuggestion | null>(null);

  const submitSearchMapResults = (query: string, results: DestinationSuggestion[]) => {
    setSubmittedSearchQuery(query);
    setSearchMapResults(results.slice(0, 8));
    setSelectedSearchResult(null);
  };

  const clearSearchMapResults = () => {
    setSubmittedSearchQuery(null);
    setSearchMapResults([]);
    setSelectedSearchResult(null);
  };

  const clearRoutePlanning = () => {
    setSelectedDestination(null);
    clearSearchMapResults();
    setIsPlanning(false);
    setIsSearching(false);
  };

  return (
    <RouteContext.Provider
      value={{
        selectedDestination,
        setSelectedDestination,
        origin,
        setOrigin,
        isSearching,
        setIsSearching,
        isPlanning,
        setIsPlanning,
        submittedSearchQuery,
        searchMapResults,
        selectedSearchResult,
        submitSearchMapResults,
        setSelectedSearchResult,
        clearSearchMapResults,
        clearRoutePlanning,
      }}>
      {children}
    </RouteContext.Provider>
  );
}

export function useRouteContext(): RouteContextValue {
  const context = useContext(RouteContext);
  if (!context) {
    throw new Error('useRouteContext must be used inside a RouteProvider');
  }
  return context;
}
