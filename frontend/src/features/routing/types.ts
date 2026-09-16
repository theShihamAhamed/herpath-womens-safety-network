export interface Destination {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface DestinationSuggestion {
  id: string;
  placeId: string;
  name: string;
  address: string;
  distanceMeters?: number;
}

export interface RouteOrigin {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}
