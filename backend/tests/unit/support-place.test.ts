import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../src/common/errors/app-error.js';
import {
  buildOverpassQuery,
  categoryForTags,
  normalizeOverpassResponse,
  OverpassSupportPlaceProvider,
} from '../../src/modules/map/overpass-support-place.provider.js';
import { SupportPlaceService } from '../../src/modules/map/support-place.service.js';
import { supportPlaceQuerySchema } from '../../src/modules/map/map.validation.js';
import type { SupportPlaceProvider } from '../../src/modules/map/support-place.provider.js';

const query = { latitude: 6.9271, longitude: 79.8612, radius: 2_000 };

describe('OpenStreetMap support-place mapping', () => {
  it.each([
    [{ amenity: 'police' }, 'POLICE'],
    [{ amenity: 'hospital' }, 'MEDICAL'],
    [{ amenity: 'clinic' }, 'MEDICAL'],
    [{ amenity: 'fire_station' }, 'EMERGENCY'],
    [{ emergency: 'ambulance_station' }, 'EMERGENCY'],
    [
      {
        amenity: 'social_facility',
        social_facility: 'shelter',
        'social_facility:for': 'woman',
      },
      'WOMENS_SUPPORT',
    ],
    [{ healthcare: 'counselling' }, 'COUNSELLING_SUPPORT'],
    [
      {
        amenity: 'social_facility',
        social_facility: 'outreach',
        'social_facility:for': 'victim',
      },
      'COUNSELLING_SUPPORT',
    ],
  ] as const)('maps documented OSM tags to %s', (tags, category) => {
    expect(categoryForTags(tags)).toBe(category);
  });

  it('excludes unrelated and insufficiently tagged places', () => {
    expect(categoryForTags({ amenity: 'pharmacy' })).toBeNull();
    expect(categoryForTags({ amenity: 'social_facility', social_facility: 'shelter' })).toBeNull();
    expect(categoryForTags({ name: 'Women Support Centre' })).toBeNull();
  });

  it('builds one bounded category-only Overpass query', () => {
    const overpassQuery = buildOverpassQuery(query);
    expect(overpassQuery).toContain('around:2000,6.9271,79.8612');
    expect(overpassQuery).toContain('["amenity"="police"]');
    expect(overpassQuery).toContain('["healthcare"="counselling"]');
    expect(overpassQuery).toContain('out center');
  });

  it('normalizes named nodes, ways, and relations with stable typed IDs', () => {
    expect(
      normalizeOverpassResponse({
        elements: [
          { type: 'node', id: 1, lat: 6.9, lon: 79.8, tags: { name: 'Police', amenity: 'police' } },
          { type: 'way', id: 2, center: { lat: 6.91, lon: 79.81 }, tags: { name: 'Hospital', amenity: 'hospital' } },
          { type: 'relation', id: 3, center: { lat: 6.92, lon: 79.82 }, tags: { name: 'Counselling', healthcare: 'counselling' } },
          { type: 'node', id: 4, lat: 6.93, lon: 79.83, tags: { amenity: 'police' } },
        ],
      }),
    ).toEqual([
      { id: 'node/1', name: 'Police', category: 'POLICE', location: { latitude: 6.9, longitude: 79.8 } },
      { id: 'way/2', name: 'Hospital', category: 'MEDICAL', location: { latitude: 6.91, longitude: 79.81 } },
      { id: 'relation/3', name: 'Counselling', category: 'COUNSELLING_SUPPORT', location: { latitude: 6.92, longitude: 79.82 } },
    ]);
  });

  it('treats malformed provider responses as unavailable rather than creating fallback places', () => {
    expect(() => normalizeOverpassResponse({ unexpected: [] })).toThrow(AppError);
  });
});

describe('Overpass support-place provider', () => {
  it('sends a polite bounded request and returns an empty real-provider response unchanged', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ elements: [] }), { status: 200 }));
    const provider = new OverpassSupportPlaceProvider('https://overpass.example/interpreter', request);

    await expect(provider.findNearby(query)).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith(
      'https://overpass.example/interpreter',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('HerPath') }),
      }),
    );
  });

  it('reports HTTP 429 as provider unavailability without a fallback', async () => {
    const request = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    const provider = new OverpassSupportPlaceProvider(undefined, request);

    await expect(provider.findNearby(query)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SUPPORT_PLACE_PROVIDER_UNAVAILABLE',
    });
  });
});

describe('support-place endpoint validation and request protection', () => {
  it('validates bounded nearby-search coordinates and radius', () => {
    expect(supportPlaceQuerySchema.parse(query)).toEqual(query);
    expect(() => supportPlaceQuerySchema.parse({ ...query, radius: 0 })).toThrow();
    expect(() => supportPlaceQuerySchema.parse({ ...query, radius: 5_001 })).toThrow();
    expect(() => supportPlaceQuerySchema.parse({ ...query, latitude: 91 })).toThrow();
    expect(() => supportPlaceQuerySchema.parse({ ...query, longitude: -181 })).toThrow();
  });

  it('shares in-flight requests and caches the normalized provider result', async () => {
    const provider = {
      findNearby: vi.fn().mockResolvedValue([
        { id: 'node/1', name: 'Police', category: 'POLICE', location: { latitude: 6.9, longitude: 79.8 } },
      ]),
    } satisfies SupportPlaceProvider;
    const service = new SupportPlaceService(provider);

    await expect(Promise.all([service.findNearby(query), service.findNearby(query)])).resolves.toEqual([
      expect.any(Array),
      expect.any(Array),
    ]);
    await service.findNearby(query);
    expect(provider.findNearby).toHaveBeenCalledTimes(1);
  });
});
