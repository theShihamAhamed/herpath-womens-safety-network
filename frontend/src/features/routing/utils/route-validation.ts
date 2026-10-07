// frontend/src/features/routing/utils/route-validation.ts

import type {
  RouteRiskScore,
  RouteWithRiskContext,
} from '../types/routing.types';

export interface RouteValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface JourneyHandoffParams {
  [key: string]: string | undefined;
  routeId: string;
  origin: string; // JSON stringified { latitude, longitude, address }
  destination: string; // JSON stringified { latitude, longitude, address }
  polyline: string;
  distance: string;
  duration: string;
  riskScore?: string;
}

export interface JourneyHandoffValidationResult {
  isValid: boolean;
  errors: string[];
  handoffParams?: JourneyHandoffParams;
}

/**
 * Validates a pair of latitude and longitude coordinates.
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Validates a LatLng object.
 */
export function validateLatLng(point: unknown): RouteValidationResult {
  const errors: string[] = [];
  if (!point || typeof point !== 'object') {
    return { isValid: false, errors: ['Coordinate point is required'] };
  }

  const p = point as { lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown };
  const lat = p.lat !== undefined ? p.lat : p.latitude;
  const lng = p.lng !== undefined ? p.lng : p.longitude;

  if (!isValidCoordinate(lat, lng)) {
    errors.push('Latitude must be between -90 and 90, Longitude must be between -180 and 180');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a RouteOrigin object.
 */
export function validateRouteOrigin(origin: unknown): RouteValidationResult {
  const errors: string[] = [];
  if (!origin || typeof origin !== 'object') {
    return { isValid: false, errors: ['Starting location is required'] };
  }

  const o = origin as {
    latitude?: unknown;
    longitude?: unknown;
    lat?: unknown;
    lng?: unknown;
    name?: unknown;
    address?: unknown;
  };

  const lat = o.latitude !== undefined ? o.latitude : o.lat;
  const lng = o.longitude !== undefined ? o.longitude : o.lng;

  if (!isValidCoordinate(lat, lng)) {
    errors.push('Origin coordinates are invalid');
  }

  if (o.name !== undefined && (typeof o.name !== 'string' || o.name.trim().length === 0)) {
    errors.push('Origin name cannot be empty');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a Destination object.
 */
export function validateRouteDestination(dest: unknown): RouteValidationResult {
  const errors: string[] = [];
  if (!dest || typeof dest !== 'object') {
    return { isValid: false, errors: ['Destination location is required'] };
  }

  const d = dest as {
    latitude?: unknown;
    longitude?: unknown;
    lat?: unknown;
    lng?: unknown;
    name?: unknown;
    address?: unknown;
  };

  const lat = d.latitude !== undefined ? d.latitude : d.lat;
  const lng = d.longitude !== undefined ? d.longitude : d.lng;

  if (!isValidCoordinate(lat, lng)) {
    errors.push('Destination coordinates are invalid');
  }

  if (d.name !== undefined && (typeof d.name !== 'string' || d.name.trim().length === 0)) {
    errors.push('Destination name cannot be empty');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates route data (geometry, distance, duration, risk info).
 */
export function validateRouteData(route: unknown): RouteValidationResult {
  const errors: string[] = [];
  if (!route || typeof route !== 'object') {
    return { isValid: false, errors: ['Route data is required'] };
  }

  const r = route as Partial<RouteWithRiskContext & RouteRiskScore>;

  if (!r.routeId || typeof r.routeId !== 'string' || r.routeId.trim().length === 0) {
    errors.push('Route ID is missing or invalid');
  }

  if (!r.polyline || typeof r.polyline !== 'string' || r.polyline.trim().length === 0) {
    errors.push('Route geometry/path is missing');
  }

  if (typeof r.distanceMeters !== 'number' || !Number.isFinite(r.distanceMeters) || r.distanceMeters < 0) {
    errors.push('Route distance is invalid');
  }

  if (typeof r.durationSeconds !== 'number' || !Number.isFinite(r.durationSeconds) || r.durationSeconds < 0) {
    errors.push('Route travel time is invalid');
  }

  if (r.nearbyIncidentCount !== undefined) {
    if (typeof r.nearbyIncidentCount !== 'number' || !Number.isFinite(r.nearbyIncidentCount) || r.nearbyIncidentCount < 0) {
      errors.push('Nearby safety report count is invalid');
    }
  }

  if (r.riskScore !== undefined) {
    if (typeof r.riskScore !== 'number' || !Number.isFinite(r.riskScore) || r.riskScore < 0) {
      errors.push('Risk score is invalid');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates all required route information before a user can continue/start a journey.
 */
export function validateRouteForJourney(params: {
  route: unknown;
  origin: unknown;
  destination: unknown;
}): JourneyHandoffValidationResult {
  const errors: string[] = [];

  const originValidation = validateRouteOrigin(params.origin);
  if (!originValidation.isValid) {
    errors.push(...originValidation.errors);
  }

  const destValidation = validateRouteDestination(params.destination);
  if (!destValidation.isValid) {
    errors.push(...destValidation.errors);
  }

  const routeValidation = validateRouteData(params.route);
  if (!routeValidation.isValid) {
    errors.push(...routeValidation.errors);
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  const o = params.origin as {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    name?: string;
    address?: string;
  };
  const d = params.destination as {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    name?: string;
    address?: string;
  };
  const r = params.route as RouteWithRiskContext & Partial<RouteRiskScore>;

  const originLat = o.latitude ?? o.lat ?? 0;
  const originLng = o.longitude ?? o.lng ?? 0;
  const originAddress = o.address ? (o.name && o.name !== o.address ? `${o.name} - ${o.address}` : o.address) : (o.name || 'Starting Location');

  const destLat = d.latitude ?? d.lat ?? 0;
  const destLng = d.longitude ?? d.lng ?? 0;
  const destAddress = d.address ? (d.name && d.name !== d.address ? `${d.name} - ${d.address}` : d.address) : (d.name || 'Destination');

  const handoffParams: JourneyHandoffParams = {
    routeId: r.routeId,
    origin: JSON.stringify({
      latitude: originLat,
      longitude: originLng,
      address: originAddress,
    }),
    destination: JSON.stringify({
      latitude: destLat,
      longitude: destLng,
      address: destAddress,
    }),
    polyline: r.polyline,
    distance: String(r.distanceMeters),
    duration: String(r.durationSeconds),
    riskScore: typeof r.riskScore === 'number' && Number.isFinite(r.riskScore) ? String(r.riskScore) : undefined,
  };

  return {
    isValid: true,
    errors: [],
    handoffParams,
  };
}

/**
 * Safely sanitizes route data for UI presentation, providing safe defaults for missing/malformed fields.
 */
export function sanitizeRouteData(
  route: Partial<RouteWithRiskContext & RouteRiskScore> | null | undefined,
): RouteWithRiskContext {
  const safeDistance = typeof route?.distanceMeters === 'number' && Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0
    ? route.distanceMeters
    : 0;
  const safeDuration = typeof route?.durationSeconds === 'number' && Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0
    ? route.durationSeconds
    : 0;

  return {
    routeId: route?.routeId ?? 'unknown-route',
    summaryLabel: route?.summaryLabel?.trim() || 'Alternative route',
    distanceMeters: safeDistance,
    distanceText: route?.distanceText?.trim() || `${(safeDistance / 1000).toFixed(1)} km`,
    durationSeconds: safeDuration,
    durationText: route?.durationText?.trim() || `${Math.round(safeDuration / 60)} min`,
    polyline: route?.polyline ?? '',
    sampledPoints: Array.isArray(route?.sampledPoints) ? route.sampledPoints : [],
    corridorRadiusMeters: typeof route?.corridorRadiusMeters === 'number' && route.corridorRadiusMeters > 0 ? route.corridorRadiusMeters : 150,
    nearbyIncidentCount: typeof route?.nearbyIncidentCount === 'number' && Number.isFinite(route.nearbyIncidentCount) && route.nearbyIncidentCount >= 0
      ? route.nearbyIncidentCount
      : 0,
    riskEvaluationStatus: 'ready_for_evaluation',
  };
}
