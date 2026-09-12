import { cellToBoundary, cellToLatLng, getResolution, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';

import type { GeoJsonPoint } from '../../src/modules/incidents/incident.types.js';
import {
  INCIDENT_PUBLIC_H3_RESOLUTION,
  exactPointToPublicCell,
  normalizeIncidentLocation,
  publicAreaFromCell,
  publicPointFromCell,
  validateResolution8Cell,
} from '../../src/modules/incidents/location-privacy.service.js';

const colombo: GeoJsonPoint = {
  type: 'Point',
  coordinates: [79.8612, 6.9271],
};

describe('incident location privacy', () => {
  it('converts an exact GeoJSON point to an H3 resolution-8 public cell', () => {
    const cellId = exactPointToPublicCell(colombo);

    expect(getResolution(cellId)).toBe(INCIDENT_PUBLIC_H3_RESOLUTION);
  });

  it('derives a representative GeoJSON point in longitude-latitude order', () => {
    const cellId = exactPointToPublicCell(colombo);
    const [expectedLatitude, expectedLongitude] = cellToLatLng(cellId);

    expect(publicPointFromCell(cellId)).toEqual({
      type: 'Point',
      coordinates: [expectedLongitude, expectedLatitude],
    });
  });

  it('derives a valid closed GeoJSON polygon without assuming a vertex count', () => {
    const cellId = exactPointToPublicCell(colombo);
    const sourceBoundary = cellToBoundary(cellId, true);
    const area = publicAreaFromCell(cellId);
    const ring = area.coordinates[0];

    expect(area.type).toBe('Polygon');
    expect(ring).toBeDefined();
    expect(ring?.length).toBeGreaterThanOrEqual(sourceBoundary.length);
    expect(ring?.at(-1)).toEqual(ring?.[0]);
    expect(ring?.every(([longitude, latitude]) =>
      longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90,
    )).toBe(true);
    expect(ring?.[0]).toEqual(sourceBoundary[0]);
  });

  it('rejects an invalid H3 cell and a valid cell at the wrong resolution', () => {
    expect(() => validateResolution8Cell('not-an-h3-cell')).toThrow(/resolution 8/i);
    expect(() => validateResolution8Cell(latLngToCell(6.9271, 79.8612, 7))).toThrow(
      /resolution 8/i,
    );
  });

  it('normalizes approximate-only input without a private location', () => {
    const cellId = exactPointToPublicCell(colombo);
    const normalized = normalizeIncidentLocation({
      mode: 'APPROXIMATE_ONLY',
      publicCellId: cellId,
    });

    expect(normalized).toMatchObject({
      locationMode: 'APPROXIMATE_ONLY',
      privateLocation: null,
      publicCellId: cellId,
    });
  });

  it('preserves an exact point privately while deriving separate public fields', () => {
    const normalized = normalizeIncidentLocation({
      mode: 'EXACT_PRIVATE',
      privateLocation: colombo,
    });

    expect(normalized.privateLocation).toEqual(colombo);
    expect(normalized.publicLocation).not.toEqual(colombo);
    expect(normalized.publicCellId).toBe(exactPointToPublicCell(colombo));
  });
});
