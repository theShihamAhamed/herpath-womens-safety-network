// backend/src/modules/routes/routeAlternatives.service.ts
// HS-120: Request alternative routes
// HS-121: Format distance and travel time for display

import { randomUUID } from 'crypto';

import { AppError } from '../../common/errors/app-error.js';
import { fetchDirections } from './openStreetMapDirections.service.js';
import type {
    RoutingRawRoute,
    RouteAlternativesRequest,
    RouteSummary,
} from './routes.types.js';

function toRouteSummary(raw: RoutingRawRoute): RouteSummary {

    const distanceMeters = raw.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    const durationSeconds = raw.legs.reduce((sum, leg) => sum + leg.duration.value, 0);

    return {
        routeId: randomUUID(),
        summaryLabel: raw.summary || 'Route',
        distanceMeters,
        distanceText: raw.legs[0]?.distance.text ?? `${(distanceMeters / 1000).toFixed(1)} km`,
        durationSeconds,
        durationText: raw.legs[0]?.duration.text ?? `${Math.round(durationSeconds / 60)} min`,
        polyline: raw.overview_polyline.points,
    };
}

export async function getRouteAlternatives(
    request: RouteAlternativesRequest
): Promise<RouteSummary[]> {
    const rawRoutes = await fetchDirections(request);

    if (rawRoutes.length === 0) {
        throw new AppError({
            statusCode: 422,
            code: 'DIRECTIONS_NO_RESULTS',
            message: 'No route could be found between the given origin and destination.',
        });
    }

    return rawRoutes.map(toRouteSummary);
}
