import type { UserLocation } from './use-user-location';

interface Coordinate {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METRES = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Returns the straight-line distance between two coordinates in metres. */
export function getSupportPlaceDistanceMetres(origin: Coordinate, destination: Coordinate): number {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.sin(longitudeDelta / 2) ** 2 * Math.cos(originLatitude) * Math.cos(destinationLatitude);

  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function formatSupportPlaceDistance(distanceMetres: number | null): string | null {
  if (distanceMetres === null || !Number.isFinite(distanceMetres) || distanceMetres < 0) {
    return null;
  }

  if (distanceMetres < 1_000) {
    return `${Math.round(distanceMetres)} m away`;
  }

  return `${(Math.round((distanceMetres / 1_000) * 10) / 10).toFixed(1)} km away`;
}

export type SupportPlaceSearchOrigin = Pick<UserLocation, 'latitude' | 'longitude'>;
