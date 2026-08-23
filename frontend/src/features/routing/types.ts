export interface Destination {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface RouteOrigin {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}