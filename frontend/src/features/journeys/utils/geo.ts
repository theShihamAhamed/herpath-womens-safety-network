export interface Coordinate { latitude: number; longitude: number; }

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceBetween(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function distanceToPath(point: Coordinate, path: Coordinate[]): number {
  if (path.length === 0) return Infinity;
  let min = Infinity;
  for (const p of path) {
    const d = distanceBetween(point, p);
    if (d < min) min = d;
  }
  return min;
}