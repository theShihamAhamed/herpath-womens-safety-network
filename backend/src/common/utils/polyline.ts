// backend/src/common/utils/polyline.ts
// Shared utility — not routes-specific, so it lives in common/utils
// (the map module may also want this later for rendering).

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Decodes a Google Maps encoded polyline string into {lat, lng} points.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Downsamples points to roughly `targetCount`, spaced evenly by index.
 * Keeps geospatial queries cheap instead of running one per decoded point.
 */
export function downsamplePoints(points: LatLng[], targetCount = 15): LatLng[] {
  if (points.length <= targetCount) return points;
  const step = points.length / targetCount;
  const sampled: LatLng[] = [];
  for (let i = 0; i < targetCount; i++) {
    const point = points[Math.floor(i * step)];
    if (point) sampled.push(point);
  }
  return sampled;
}
