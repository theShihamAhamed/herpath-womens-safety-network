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
}

export interface RouteOrigin {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}
