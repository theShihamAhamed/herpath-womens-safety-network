// backend/src/modules/routes/googleDirections.service.ts
// HS-119: Integrate routing API

import axios from 'axios';
import type { GoogleRawRoute, RouteAlternativesRequest } from './routes.types.js';

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

interface GoogleDirectionsResponse {
  status: string;
  error_message?: string;
  routes: GoogleRawRoute[];
}

/**
 * NOTE on config: this reads GOOGLE_MAPS_API_KEY directly from process.env.
 * If backend/src/config/ already has a validated env schema (e.g. via zod),
 * add GOOGLE_MAPS_API_KEY there instead and import it from there —
 * that keeps env validation centralized in server.ts startup, per your
 * existing config/ convention.
 */
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('[routes] GOOGLE_MAPS_API_KEY is not set — Directions calls will fail.');
}

/**
 * Thin wrapper around Google's Directions API.
 * Always requests alternatives=true so HS-120 gets multiple options.
 */
export async function fetchDirections(
  req: RouteAlternativesRequest
): Promise<GoogleRawRoute[]> {
  const { origin, destination, mode = 'walking' } = req;

  const { data } = await axios.get<GoogleDirectionsResponse>(DIRECTIONS_URL, {
    params: {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode,
      alternatives: true,
      key: GOOGLE_MAPS_API_KEY,
    },
    timeout: 10_000,
  });

  if (data.status !== 'OK') {
    throw new Error(
      `Directions API error: ${data.status}${
        data.error_message ? ` — ${data.error_message}` : ''
      }`
    );
  }

  return data.routes;
}
