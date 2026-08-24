// backend/src/modules/routes/googleDirections.service.ts
// HS-119: Integrate routing API

import axios from 'axios';

import { AppError } from '../../common/errors/app-error.js';
import type { GoogleRawRoute, RouteAlternativesRequest } from './routes.types.js';

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

interface GoogleDirectionsResponse {
  status: string;
  error_message?: string;
  routes: GoogleRawRoute[];
}

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY ?? '';
  if (!key) {
    console.warn('[routes] GOOGLE_MAPS_API_KEY is not set — Directions calls will fail.');
  }
  return key;
}

/**
 * Thin wrapper around Google's Directions API.
 * Always requests alternatives=true so HS-120 gets multiple options.
 *
 * Throws an AppError (502) when the upstream Directions API fails so the
 * error-handling middleware can return a clean, structured response instead
 * of a generic 500.
 */
export async function fetchDirections(
  req: RouteAlternativesRequest
): Promise<GoogleRawRoute[]> {
  const { origin, destination, mode = 'walking' } = req;
  const key = getApiKey();

  let data: GoogleDirectionsResponse;

  try {
    const response = await axios.get<GoogleDirectionsResponse>(DIRECTIONS_URL, {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode,
        alternatives: true,
        key,
      },
      timeout: 10_000,
    });
    data = response.data;
  } catch (err) {
    // Network error, timeout, etc.
    throw new AppError({
      statusCode: 502,
      code: 'DIRECTIONS_UPSTREAM_ERROR',
      message: 'Could not reach the routing service. Please try again shortly.',
      cause: err,
    });
  }

  if (data.status === 'REQUEST_DENIED') {
    throw new AppError({
      statusCode: 503,
      code: 'DIRECTIONS_API_KEY_INVALID',
      message: 'Route directions are not available right now (service configuration issue).',
    });
  }

  if (data.status === 'ZERO_RESULTS') {
    throw new AppError({
      statusCode: 422,
      code: 'DIRECTIONS_NO_RESULTS',
      message: 'No route could be found between the given origin and destination.',
    });
  }

  if (data.status !== 'OK') {
    throw new AppError({
      statusCode: 502,
      code: 'DIRECTIONS_API_ERROR',
      message: `Routing service returned an unexpected status: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`,
    });
  }

  return data.routes;
}
