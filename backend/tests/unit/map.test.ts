import { describe, expect, it } from 'vitest';

import { MapService } from '../../src/modules/map/map.service.js';
import { viewportQuerySchema } from '../../src/modules/map/map.validation.js';

describe('community safety map contracts', () => {
  it('accepts a bounded public-marker query with all supported filters', () => {
    expect(
      viewportQuerySchema.parse({
        swLat: 6.8,
        swLng: 79.8,
        neLat: 7,
        neLng: 80,
        category: 'HARASSMENT',
        severity: 'HIGH',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-17',
        startHour: 18,
        endHour: 5,
      }),
    ).toMatchObject({ category: 'HARASSMENT', severity: 'HIGH' });
  });

  it('rejects an inverted date range', () => {
    expect(() =>
      viewportQuerySchema.parse({
        swLat: 6.8,
        swLng: 79.8,
        neLat: 7,
        neLng: 80,
        dateFrom: '2026-08-17',
        dateTo: '2026-08-01',
      }),
    ).toThrow(/dateTo must be on or after dateFrom/);
  });

  it('returns no fabricated public incidents before repository integration', async () => {
    await expect(
      new MapService().getPublicIncidentsInViewport({
        swLat: 6.8,
        swLng: 79.8,
        neLat: 7,
        neLng: 80,
      }),
    ).resolves.toEqual([]);
  });
});
