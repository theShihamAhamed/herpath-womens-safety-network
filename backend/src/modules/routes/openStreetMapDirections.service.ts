// HS-119: Integrate the no-key OpenStreetMap routing service

import axios from 'axios';

import { AppError } from '../../common/errors/app-error.js';
import type { RoutingRawRoute, RouteAlternativesRequest } from './routes.types.js';

const ROUTING_URLS = {
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  driving: 'https://router.project-osrm.org/route/v1/driving',
  bicycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
} as const;

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: string;
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes: OsrmRoute[];
}

export async function fetchDirections(
  req: RouteAlternativesRequest,
): Promise<RoutingRawRoute[]> {
  const { origin, destination, mode = 'walking' } = req;
  const url = `${ROUTING_URLS[mode]}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

  let data: OsrmResponse;

  try {
    const response = await axios.get<OsrmResponse>(url, {
      params: {
        alternatives: true,
        overview: 'full',
        geometries: 'polyline',
      },
      timeout: 10_000,
    });
    data = response.data;
  } catch (err) {
    throw new AppError({
      statusCode: 502,
      code: 'DIRECTIONS_UPSTREAM_ERROR',
      message: 'Could not reach the routing service. Please try again shortly.',
      cause: err,
    });
  }

  if (data.code === 'NoRoute') {
    throw new AppError({
      statusCode: 422,
      code: 'DIRECTIONS_NO_RESULTS',
      message: 'No route could be found between the given origin and destination.',
    });
  }

  if (data.code !== 'Ok') {
    throw new AppError({
      statusCode: 502,
      code: 'DIRECTIONS_API_ERROR',
      message: `Routing service returned an unexpected status: ${data.code}${data.message ? ` - ${data.message}` : ''}`,
    });
  }

  return data.routes.map((route, index) => ({
    summary: index === 0 ? 'Recommended route' : `Alternative route ${index}`,
    overview_polyline: { points: route.geometry },
    legs: [{
      distance: {
        value: route.distance,
        text: `${(route.distance / 1000).toFixed(1)} km`,
      },
      duration: {
        value: Math.round(route.duration),
        text: `${Math.round(route.duration / 60)} min`,
      },
      start_location: origin,
      end_location: destination,
    }],
    warnings: [],
  }));
}