export interface Destination {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface DestinationSearchQuery {
  q: string;
  lat?: number | undefined;
  lng?: number | undefined;
}
