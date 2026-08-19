import {
  cellToBoundary,
  cellToLatLng,
  getResolution,
  isValidCell,
  latLngToCell,
  POLYGON_TO_CELLS_FLAGS,
  polygonToCellsExperimental,
} from 'h3-js';

import type {
  GeoJsonPoint,
  GeoJsonPolygon,
  IncidentViewport,
  IncidentLocationInput,
  NormalizedIncidentLocation,
  Position,
  PublicLocationCell,
} from './incident.types.js';

export const INCIDENT_PUBLIC_H3_RESOLUTION = 8;
export const MAX_SELECTABLE_LOCATION_CELLS = 200;

export class SelectableLocationCellLimitError extends Error {
  public constructor(
    public readonly cellCount: number,
    public readonly maximum: number,
  ) {
    super('The selected viewport contains too many public location cells');
    this.name = 'SelectableLocationCellLimitError';
  }
}

function locationError(message: string): TypeError {
  return new TypeError(message);
}

function assertCoordinate(value: number, minimum: number, maximum: number, name: string): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw locationError(`${name} must be a finite number between ${minimum} and ${maximum}`);
  }
}

export function validateGeoJsonPoint(point: GeoJsonPoint): GeoJsonPoint {
  if (point.type !== 'Point' || point.coordinates.length !== 2) {
    throw locationError('Incident location must be a valid GeoJSON Point');
  }

  const [longitude, latitude] = point.coordinates;
  assertCoordinate(longitude, -180, 180, 'Longitude');
  assertCoordinate(latitude, -90, 90, 'Latitude');

  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

export function exactPointToPublicCell(point: GeoJsonPoint): string {
  const validatedPoint = validateGeoJsonPoint(point);
  const [longitude, latitude] = validatedPoint.coordinates;
  return latLngToCell(latitude, longitude, INCIDENT_PUBLIC_H3_RESOLUTION);
}

export function isResolution8Cell(cellId: string): boolean {
  return isValidCell(cellId) && getResolution(cellId) === INCIDENT_PUBLIC_H3_RESOLUTION;
}

export function validateResolution8Cell(cellId: string): string {
  const normalizedCellId = cellId.trim().toLowerCase();

  if (!isResolution8Cell(normalizedCellId)) {
    throw locationError(
      `Public incident cell must be a valid H3 resolution ${INCIDENT_PUBLIC_H3_RESOLUTION} cell`,
    );
  }

  return normalizedCellId;
}

export function publicPointFromCell(cellId: string): GeoJsonPoint {
  const validatedCellId = validateResolution8Cell(cellId);
  const [latitude, longitude] = cellToLatLng(validatedCellId);

  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

export function publicAreaFromCell(cellId: string): GeoJsonPolygon {
  const validatedCellId = validateResolution8Cell(cellId);
  const boundary = cellToBoundary(validatedCellId, true);
  const ring: Position[] = boundary.map(([longitude, latitude]) => [longitude, latitude]);
  const first = ring[0];
  const last = ring.at(-1);

  if (!first || !last) {
    throw locationError('Public incident cell has no boundary');
  }

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

export function normalizeIncidentLocation(
  location: IncidentLocationInput,
): NormalizedIncidentLocation {
  if (location.mode === 'EXACT_PRIVATE') {
    const privateLocation = validateGeoJsonPoint(location.privateLocation);
    const publicCellId = exactPointToPublicCell(privateLocation);

    return {
      locationMode: 'EXACT_PRIVATE',
      privateLocation,
      publicCellId,
      publicLocation: publicPointFromCell(publicCellId),
    };
  }

  const publicCellId = validateResolution8Cell(location.publicCellId);
  return {
    locationMode: 'APPROXIMATE_ONLY',
    privateLocation: null,
    publicCellId,
    publicLocation: publicPointFromCell(publicCellId),
  };
}

export function selectableLocationCells(
  viewport: IncidentViewport,
  maximum = MAX_SELECTABLE_LOCATION_CELLS,
): PublicLocationCell[] {
  const polygon = [
    [viewport.west, viewport.south],
    [viewport.east, viewport.south],
    [viewport.east, viewport.north],
    [viewport.west, viewport.north],
    [viewport.west, viewport.south],
  ];
  const cellIds = polygonToCellsExperimental(
    polygon,
    INCIDENT_PUBLIC_H3_RESOLUTION,
    POLYGON_TO_CELLS_FLAGS.containmentOverlapping,
    true,
  ).sort();

  if (cellIds.length > maximum) {
    throw new SelectableLocationCellLimitError(cellIds.length, maximum);
  }

  return cellIds.map((cellId) => ({
    cellId,
    publicLocation: publicPointFromCell(cellId),
    publicArea: publicAreaFromCell(cellId),
  }));
}
