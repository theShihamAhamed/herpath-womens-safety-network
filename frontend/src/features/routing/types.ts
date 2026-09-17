export interface Destination {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface DestinationSuggestion {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  /** Optional broad provider category, if the search API supplies one. */
  category?: string;
}

export interface RouteOrigin {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}
