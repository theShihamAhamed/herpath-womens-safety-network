import { createContext, ReactNode, useContext, useState } from 'react';

import { Destination, RouteOrigin } from './types';

interface RouteContextValue {
  selectedDestination: Destination | null;
  setSelectedDestination: (destination: Destination | null) => void;
  origin: RouteOrigin | null;
  setOrigin: (origin: RouteOrigin | null) => void;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
  isPlanning: boolean;
  setIsPlanning: (isPlanning: boolean) => void;
  clearRoutePlanning: () => void;
}

const RouteContext = createContext<RouteContextValue | undefined>(undefined);

export function RouteProvider({ children }: { children: ReactNode }) {
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [origin, setOrigin] = useState<RouteOrigin | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);

  const clearRoutePlanning = () => {
    setSelectedDestination(null);
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