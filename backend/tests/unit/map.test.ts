import { describe, expect, it, vi } from 'vitest';

import type { PublicIncidentReader } from '../../src/modules/incidents/incident.public-reader.js';
import type { PublicIncident } from '../../src/modules/incidents/incident.public.js';
import { MapService } from '../../src/modules/map/map.service.js';
import {
  areaSummaryQuerySchema,
  viewportQuerySchema,
} from '../../src/modules/map/map.validation.js';

const publicIncident: PublicIncident = {
  id: 'incident-1',
  category: 'HARASSMENT',
  severity: 'HIGH',
  status: 'PUBLISHED_UNVERIFIED',
  occurredAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
  createdAt: new Date().toISOString(),
  supportCount: 2,
  publicLocation: { type: 'Point', coordinates: [79.861, 6.927] },
  publicArea: {
    type: 'Polygon',
    coordinates: [[
      [79.86, 6.926],
      [79.862, 6.926],
      [79.862, 6.928],
      [79.86, 6.926],
    ]],
  },
};

function readerWith(incidents: PublicIncident[]): PublicIncidentReader {
  return {
    findInViewport: vi.fn().mockResolvedValue(incidents),
    findWithinRadius: vi.fn().mockResolvedValue(incidents),
  };
}

describe('community safety map contracts', () => {
  it('accepts strict viewport filters with offset-aware occurrence instants', () => {
    const result = viewportQuerySchema.parse({
      swLat: 6.8,
      swLng: 79.8,
      neLat: 7,
      neLng: 80,
      category: 'HARASSMENT',
      severity: 'HIGH',
      occurredFrom: '2026-08-01T00:00:00Z',
      occurredTo: '2026-08-18T23:59:59+05:30',
    });

    expect(result).toMatchObject({ category: 'HARASSMENT', severity: 'HIGH' });
    expect(result.occurredFrom).toEqual(new Date('2026-08-01T00:00:00Z'));
    expect(result.occurredTo).toEqual(new Date('2026-08-18T18:29:59Z'));
  });

  it('rejects inverted, wrapped, malformed, and stale query contracts', () => {
    const bounds = { swLat: 6.8, swLng: 79.8, neLat: 7, neLng: 80 };
    expect(() => viewportQuerySchema.parse({ ...bounds, neLat: 6.7 })).toThrow(/neLat/);
    expect(() => viewportQuerySchema.parse({ ...bounds, swLng: 170, neLng: -170 })).toThrow(
      /wrapped/,
    );
    expect(() => viewportQuerySchema.parse({ ...bounds, occurredFrom: '2026-08-01' })).toThrow(
      /ISO-8601/,
    );
    expect(() => viewportQuerySchema.parse({ ...bounds, dateFrom: '2026-08-01' })).toThrow();
    expect(() =>
      viewportQuerySchema.parse({
        ...bounds,
        occurredFrom: '2026-08-18T00:00:00Z',
        occurredTo: '2026-08-01T00:00:00Z',
      }),
    ).toThrow(/occurredTo must be on or after occurredFrom/);
    expect(() =>
      areaSummaryQuerySchema.parse({
        lat: 6.927,
        lng: 79.861,
        occurredFrom: '2026-08-18T00:00:00Z',
        occurredTo: '2026-08-01T00:00:00Z',
      }),
    ).toThrow(/occurredTo must be on or after occurredFrom/);
  });

  it('passes Map-owned viewport and occurrence filters to the public Incident reader', async () => {
    const reader = readerWith([publicIncident]);
    const service = new MapService(reader);
    const occurredFrom = new Date('2026-08-01T00:00:00Z');

    await expect(
      service.getPublicIncidentsInViewport({
        swLat: 6.8,
        swLng: 79.8,
        neLat: 7,
        neLng: 80,
        category: 'HARASSMENT',
        severity: 'HIGH',
        occurredFrom,
      }),
    ).resolves.toEqual([publicIncident]);
    expect(reader.findInViewport).toHaveBeenCalledWith({
      south: 6.8,
      west: 79.8,
      north: 7,
      east: 80,
      category: 'HARASSMENT',
      severity: 'HIGH',
      occurredFrom,
    });
  });

  it('aggregates the existing area-summary contract using occurrence time', async () => {
    const oldIncident: PublicIncident = {
      ...publicIncident,
      id: 'incident-2',
      category: 'THEFT',
      severity: 'LOW',
      occurredAt: new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString(),
    };
    const query = areaSummaryQuerySchema.parse({ lat: 6.927, lng: 79.861 });
    const summary = await new MapService(readerWith([publicIncident, oldIncident])).getAreaSummary(
      query,
    );

    expect(summary).toMatchObject({
      center: { latitude: 6.927, longitude: 79.861 },
      radiusMeters: 1000,
      totalIncidents: 2,
      recentCount: 1,
      byCategory: { HARASSMENT: 1, THEFT: 1 },
      bySeverity: { HIGH: 1, LOW: 1 },
    });
  });
});
