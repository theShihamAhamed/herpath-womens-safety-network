import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import type { AppError } from '../../src/common/errors/app-error.js';
import { GeocodingService, parseGeoapifyAutocompleteResponse, selectRelevantGeoapifyCategory } from '../../src/modules/routes/geocoding.service.js';
import { RoutesController } from '../../src/modules/routes/routes.controller.js';
import { destinationSearchQuerySchema } from '../../src/modules/routes/routes.validation.js';
import type { PublicIncidentReader } from '../../src/modules/incidents/incident.public-reader.js';
import type { PublicIncident } from '../../src/modules/incidents/incident.public.js';
import { prepareRoutesForRiskEvaluation } from '../../src/modules/routes/routeRisk.service.js';
import { scoreRouteRisk } from '../../src/modules/routes/riskScoring.service.js';
import type { RouteWithRiskContext } from '../../src/modules/routes/routes.types.js';
import { parseNearbyPlaceIntent } from '../../src/modules/routes/nearby-place-intent.js';

describe('nearby place intent parsing', () => {
  it.each([
    ['hospital near me', 'healthcare.hospital'], ['Laundry near me', 'service.cleaning.laundry'],
    ['BANK NEAR ME', 'service.financial.bank'], ['pizza near me   ', 'catering.restaurant.pizza,catering.fast_food.pizza'],
    ['fuel station near me', 'service.vehicle.fuel'], ['petrol station near me', 'service.vehicle.fuel'], ['gas station near me', 'service.vehicle.fuel'],
  ])('recognizes %s', (query, category) => expect(parseNearbyPlaceIntent(query)?.category).toBe(category));

  it.each(['Asiri Hospital', 'Pizza Hut', 'Commercial Bank', 'SLIIT', 'near me'])('does not treat %s as nearby intent', (query) => {
    expect(parseNearbyPlaceIntent(query)).toBeNull();
  });
});

describe('Geoapify autocomplete category parsing', () => {
  it('preserves provider category object keys in order and ignores malformed values', () => {
    expect(parseGeoapifyAutocompleteResponse({ results: [], query: { categories: [{ keys: ['religion.place_of_worship', 'religion.place_of_worship.islam'] }, { keys: [null, 123, '', 'tourism'] }] } }).categories).toEqual(['religion.place_of_worship', 'religion.place_of_worship.islam', 'tourism']);
  });

  it('keeps category labels with their ordered provider keys', () => {
    const parsed = parseGeoapifyAutocompleteResponse({
      results: [],
      query: { categories: [{ keys: ['healthcare.hospital', 'healthcare'], label: 'Hospitals' }] },
    });

    expect(parsed.categoryMetadata).toEqual([{ keys: ['healthcare.hospital', 'healthcare'], label: 'Hospitals' }]);
  });
});

describe('provider category relevance', () => {
  it.each([
    ['hosp', [{ keys: ['healthcare.hospital'], label: 'Hospitals' }], 'healthcare.hospital'],
    ['mosq', [{ keys: ['tourism.sights.place_of_worship.mosque'], label: 'Mosques' }], 'tourism.sights.place_of_worship.mosque'],
    ['tem', [{ keys: ['tourism.sights.place_of_worship.temple'], label: 'Temples' }], 'tourism.sights.place_of_worship.temple'],
    ['sal', [{ keys: ['catering.restaurant.ukrainian'], label: 'Ukrainian Restaurants' }, { keys: ['adult.casino'], label: 'Casino' }], undefined],
  ])('selects the expected category for %s', (query, categories, expected) => {
    expect(selectRelevantGeoapifyCategory(query, categories)).toBe(expected);
  });
});

describe('destination search validation contracts', () => {
  it('accepts valid query strings with optional coordinates', () => {
    const validQuery = destinationSearchQuerySchema.parse({
      q: 'Colombo Fort',
      lat: 6.9344,
      lng: 79.8501,
    });

    expect(validQuery).toEqual({
      q: 'Colombo Fort',
      lat: 6.9344,
      lng: 79.8501,
    });
  });

  it('trims whitespace and accepts valid single-parameter search query', () => {
    const validQuery = destinationSearchQuerySchema.parse({
      q: '  Galle Face Green  ',
    });

    expect(validQuery.q).toBe('Galle Face Green');
  });

  it.each(['a', 'A', 'h', 'H'])('accepts one-character autocomplete query %s', (query) => {
    expect(destinationSearchQuerySchema.parse({ q: query }).q).toBe(query);
  });

  it('rejects blank autocomplete queries', () => {
    expect(() => destinationSearchQuerySchema.parse({ q: '   ' })).toThrow();
    expect(() => destinationSearchQuerySchema.parse({ q: '' })).toThrow();
  });

  it('rejects queries exceeding max character limit', () => {
    const longQuery = 'x'.repeat(101);
    expect(() => destinationSearchQuerySchema.parse({ q: longQuery })).toThrow(
      /not exceed 100 characters/,
    );
  });

  it('rejects out-of-range coordinates', () => {
    expect(() =>
      destinationSearchQuerySchema.parse({ q: 'Test', lat: 95, lng: 80 }),
    ).toThrow();
    expect(() =>
      destinationSearchQuerySchema.parse({ q: 'Test', lat: 6, lng: 190 }),
    ).toThrow();
  });
});

describe('GeocodingService retrieval', () => {
  it('returns prioritized, deduplicated merged dynamic place suggestions capped at eight', async () => {
    const autocompleteResults = Array.from({ length: 8 }, (_, index) => ({ place_id: `auto-${index}`, name: index === 0 ? 'Nearby Hospital' : `Autocomplete ${index}`, lat: 6.9 + index / 1000, lon: 79.8 + index / 1000 }));
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: autocompleteResults, query: { categories: ['healthcare.hospital'] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [
        { properties: { place_id: 'place-1', name: 'Nearby Hospital', distance: 50 }, geometry: { coordinates: [79.8, 6.9] } },
        { properties: { place_id: 'place-2', name: 'Nearby Hospital', distance: 100 }, geometry: { coordinates: [79.801, 6.901] } },
      ] }), { status: 200 }));
    const results = await new GeocodingService('test-key', request).searchPlaces({ q: 'hosp', lat: 6.9, lng: 79.8 });
    expect(results).toHaveLength(8);
    expect(results.slice(0, 2).map((item) => item.id)).toEqual(['place-1', 'place-2']);
    expect(results.filter((item) => item.name === 'Nearby Hospital')).toHaveLength(2);
  });
  it('uses one dynamic Places request from provider-discovered categories', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ place_id: 'auto', name: 'Hosp', lat: 6.9, lon: 79.8 }], query: { categories: [{ keys: ['healthcare.hospital', 'healthcare'] }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [{ properties: { place_id: 'poi', name: 'Hospital', distance: 20 }, geometry: { coordinates: [79.8612, 6.9271] } }] }), { status: 200 }));
    const result = await new GeocodingService('test-key', request).searchDestinationSources({ q: 'hosp', lat: 6.9271, lng: 79.8612 });
    expect(result.placesResults).toMatchObject([{ id: 'poi', distanceMeters: 20 }]);
    expect(request).toHaveBeenCalledTimes(2);
    const placesUrl = new URL(request.mock.calls[1]?.[0] as string);
    expect(placesUrl.searchParams.get('categories')).toBe('healthcare.hospital');
    expect(placesUrl.searchParams.get('bias')).toBe('proximity:79.8612,6.9271');
    expect(placesUrl.searchParams.get('filter')).toBeNull();
  });
  it('uses amenity fallback once when all provider categories are irrelevant', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ place_id: 'auto', name: 'Salem', lat: 1, lon: 2 }],
        query: { categories: [{ keys: ['catering.restaurant.ukrainian'], label: 'Ukrainian Restaurants' }, { keys: ['adult.casino'], label: 'Casino' }] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ place_id: 'amenity', name: 'Nearby Salon', lat: 6.9, lon: 79.8, distance: 100 }] }), { status: 200 }));

    const results = await new GeocodingService('test-key', request).searchPlaces({ q: 'sal', lat: 6.9, lng: 79.8 });

    expect(results[0]?.id).toBe('amenity');
    expect(request).toHaveBeenCalledTimes(2);
    expect(new URL(request.mock.calls[1]?.[0] as string).searchParams.get('type')).toBe('amenity');
    expect(new URL(request.mock.calls[1]?.[0] as string).searchParams.get('bias')).toBe('proximity:79.8,6.9');
  });
  it('uses amenity fallback once when provider metadata is absent', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ place_id: 'auto', name: 'Salon', lat: 1, lon: 2 }], query: { categories: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ place_id: 'amenity', name: 'Nearby Salon', lat: 6.9, lon: 79.8 }] }), { status: 200 }));

    const results = await new GeocodingService('test-key', request).searchPlaces({ q: 'salon', lat: 6.9, lng: 79.8 });

    expect(results.map((result) => result.id)).toEqual(['amenity', 'auto']);
    expect(request).toHaveBeenCalledTimes(2);
    expect(new URL(request.mock.calls[1]?.[0] as string).searchParams.get('type')).toBe('amenity');
  });
  it('rejects unnamed dynamic Places, then prioritizes one amenity fallback', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ place_id: 'auto', name: 'Templeuve', lat: 1, lon: 2 }],
        query: { categories: [{ keys: ['tourism.sights.place_of_worship.temple'], label: 'Temples' }] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [{
        properties: { place_id: 'unnamed-temple', address_line1: 'Ganemulla-Weligampitiya Road', categories: ['tourism.sights.place_of_worship.temple'] },
        geometry: { coordinates: [79.95, 7.06] },
      }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ place_id: 'named-temple', name: 'Nearby Temple', lat: 6.93, lon: 79.86, distance: 500 }] }), { status: 200 }));

    const results = await new GeocodingService('test-key', request).searchPlaces({ q: 'temple', lat: 6.9, lng: 79.8 });

    expect(results.map((result) => result.id)).toEqual(['named-temple', 'auto']);
    expect(results.map((result) => result.name)).not.toContain('Ganemulla-Weligampitiya Road');
    expect(request).toHaveBeenCalledTimes(3);
    expect(new URL(request.mock.calls[1]?.[0] as string).pathname).toBe('/v2/places');
    expect(new URL(request.mock.calls[2]?.[0] as string).searchParams.get('type')).toBe('amenity');
  });
  it('keeps named dynamic Places prioritized without amenity fallback', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ place_id: 'auto', name: 'Mosque', lat: 1, lon: 2 }],
        query: { categories: [{ keys: ['tourism.sights.place_of_worship.mosque'], label: 'Mosques' }] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [{
        properties: { place_id: 'nearby-mosque', name: 'Nearby Mosque', distance: 100 },
        geometry: { coordinates: [79.8, 6.9] },
      }] }), { status: 200 }));

    const results = await new GeocodingService('test-key', request).searchPlaces({ q: 'mosq', lat: 6.9, lng: 79.8 });

    expect(results.map((result) => result.id)).toEqual(['nearby-mosque', 'auto']);
    expect(request).toHaveBeenCalledTimes(2);
    expect(new URL(request.mock.calls[1]?.[0] as string).pathname).toBe('/v2/places');
  });
  it('uses Places with real coordinates for recognized nearby intent', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [{ properties: { place_id: 'poi-1', name: 'Police Hospital', formatted: 'Colombo, Sri Lanka', distance: 850 }, geometry: { coordinates: [79.8613, 6.9272] } }] }), { status: 200 }));
    const service = new GeocodingService('test-key', request);
    await expect(service.searchPlaces({ q: 'hospital near me', lat: 6.9271, lng: 79.8612 })).resolves.toMatchObject([{ id: 'poi-1', latitude: 6.9272, longitude: 79.8613, distanceMeters: 850 }]);
    const url = new URL(request.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/v2/places');
    expect(url.searchParams.get('categories')).toBe('healthcare.hospital');
    expect(url.searchParams.get('filter')).toBeNull();
    expect(url.searchParams.get('bias')).toBe('proximity:79.8612,6.9271');
  });

  it('requires location for nearby intent without calling Places', async () => {
    const request = vi.fn();
    await expect(new GeocodingService('test-key', request).searchPlaces({ q: 'hospital near me' })).rejects.toMatchObject({ code: 'DESTINATION_LOCATION_REQUIRED' });
    expect(request).not.toHaveBeenCalled();
  });
  it('returns normalized real provider results and biases normal and amenity autocomplete around real location', async () => {
    const request = vi.fn().mockImplementation(() => new Response(JSON.stringify({ results: [{ place_id: 'geo-1', name: 'Colombo Fort', address_line2: 'Colombo, Sri Lanka', lat: 6.9344, lon: 79.8501, distance: 320 }] }), { status: 200 }));
    const service = new GeocodingService('test-key', request);

    await expect(service.searchPlaces({ q: 'Colombo Fort', lat: 6.9, lng: 79.8 })).resolves.toEqual([
      {
        id: 'geo-1', name: 'Colombo Fort',
        address: 'Colombo, Sri Lanka',
        latitude: 6.9344, longitude: 79.8501,
        distanceMeters: 320,
      },
    ]);
    const requestUrl = new URL(request.mock.calls[0]?.[0] as string);
    expect(requestUrl.searchParams.get('filter')).toBeNull();
    expect(requestUrl.searchParams.get('bias')).toBe('proximity:79.8,6.9');
    expect(new URL(request.mock.calls[1]?.[0] as string).searchParams.get('type')).toBe('amenity');
    expect(new URL(request.mock.calls[1]?.[0] as string).searchParams.get('bias')).toBe('proximity:79.8,6.9');
  });

  it.each(['a', 'A', 'h', 'H'])('sends one-character query %s to the provider', async (query) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const service = new GeocodingService('test-key', request);

    await service.searchPlaces({ q: query });
    expect(new URL(request.mock.calls[0]?.[0] as string).searchParams.get('text')).toBe(query);
  });

  it('keeps Sri Lanka filtering when no user location is available', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const service = new GeocodingService('test-key', request);

    await service.searchPlaces({ q: 'ap' });
    const requestUrl = new URL(request.mock.calls[0]?.[0] as string);
    expect(requestUrl.searchParams.get('filter')).toBeNull();
    expect(requestUrl.searchParams.get('bias')).toBeNull();
  });

  it('routes a recognized trailing near-me phrase to Places', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const service = new GeocodingService('test-key', request);

    await service.searchPlaces({ q: 'Laundry near me', lat: 6.9271, lng: 79.8612 });
    const requestUrl = new URL(request.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toBe('/v2/places');
    expect(requestUrl.searchParams.get('categories')).toBe('service.cleaning.laundry');
    expect(requestUrl.searchParams.get('filter')).toBeNull();
    expect(requestUrl.searchParams.get('bias')).toBe('proximity:79.8612,6.9271');
  });

  it('returns an empty array for successful empty normal and amenity provider responses without fabricating places', async () => {
    const request = vi.fn().mockImplementation(() => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const service = new GeocodingService('test-key', request);

    await expect(service.searchPlaces({ q: 'zzz' })).resolves.toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('uses a global amenity fallback without inventing a location', async () => {
    const request = vi.fn().mockImplementation(() => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const service = new GeocodingService('test-key', request);

    await expect(service.searchPlaces({ q: 'London' })).resolves.toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
    const amenityUrl = new URL(request.mock.calls[1]?.[0] as string);
    expect(amenityUrl.searchParams.get('type')).toBe('amenity');
    expect(amenityUrl.searchParams.get('filter')).toBeNull();
    expect(amenityUrl.searchParams.get('bias')).toBeNull();
  });

  it('reports provider failure instead of returning a synthetic destination', async () => {
    const request = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    const service = new GeocodingService('test-key', request);

    await expect(service.searchPlaces({ q: 'Custom Safe Hub' })).rejects.toMatchObject({
      statusCode: 503,
      code: 'DESTINATION_SEARCH_UNAVAILABLE',
    } satisfies Partial<AppError>);
  });
});

describe('RoutesController', () => {
  it('passes search parameters to GeocodingService and returns success response', async () => {
    const mockService = {
      searchPlaces: vi.fn().mockResolvedValue([
        {
          id: 'test-1',
          name: 'Test Place',
          address: '123 Test St',
          latitude: 6.9,
          longitude: 79.8,
        },
      ]),
    } as unknown as GeocodingService;

    const controller = new RoutesController(mockService);

    const mockRequest = {
      query: { q: 'Test Place', lat: 6.9, lng: 79.8 },
    } as unknown as Request;

    let responseData: unknown;

    const mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data: unknown) => {
        responseData = data;
        return mockResponse;
      }),
    } as unknown as Response;

    const mockNext = vi.fn() as unknown as NextFunction;

    await controller.searchDestinations(mockRequest, mockResponse, mockNext);

    expect(mockService.searchPlaces).toHaveBeenCalledWith({
      q: 'Test Place',
      lat: 6.9,
      lng: 79.8,
    });
    expect(mockNext).not.toHaveBeenCalled();

    expect(responseData).toMatchObject({
      success: true,
      data: [
        {
          id: 'test-1',
          name: 'Test Place',
          address: '123 Test St',
          latitude: 6.9,
          longitude: 79.8,
        },
      ],
    });
  });

  it('forwards error to next function if service fails', async () => {
    const error = new Error('Geocoding failure');
    const mockService = {
      searchPlaces: vi.fn().mockRejectedValue(error),
    } as unknown as GeocodingService;

    const controller = new RoutesController(mockService);
    const mockRequest = {
      query: { q: 'Test Place' },
    } as unknown as Request;
    const mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const mockNext = vi.fn() as unknown as NextFunction;

    await controller.searchDestinations(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});

function publicIncident(id: string, status: PublicIncident['status']): PublicIncident {
  return {
    id,
    category: 'HARASSMENT',
    severity: 'HIGH',
    status,
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    supportCount: status === 'COMMUNITY_SUPPORTED' ? 3 : 0,
    publicLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
    publicArea: {
      type: 'Polygon',
      coordinates: [[[79.86, 6.92], [79.87, 6.92], [79.87, 6.93], [79.86, 6.92]]],
    },
  };
}

describe('visibility-authoritative route incident reads', () => {
  it('uses the Incident public reader for route preview counts', async () => {
    const findWithinRadius = vi.fn().mockResolvedValue([
      publicIncident('supported', 'COMMUNITY_SUPPORTED'),
      publicIncident('disputed', 'DISPUTED'),
    ]);
    const reader = { findWithinRadius } as unknown as PublicIncidentReader;
    const routes = await prepareRoutesForRiskEvaluation(
      [
        {
          routeId: 'route-a',
          summaryLabel: 'Route A',
          distanceMeters: 1_000,
          distanceText: '1 km',
          durationSeconds: 600,
          durationText: '10 min',
          polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        },
      ],
      reader,
    );

    expect(findWithinRadius).toHaveBeenCalled();
    expect(routes[0]?.nearbyIncidentCount).toBeGreaterThanOrEqual(2);
  });

  it('scores every incident returned by the privacy-safe reader and deduplicates overlaps', async () => {
    const findWithinRadius = vi.fn().mockResolvedValue([
      publicIncident('supported', 'COMMUNITY_SUPPORTED'),
      publicIncident('disputed', 'DISPUTED'),
    ]);
    const reader = { findWithinRadius } as unknown as PublicIncidentReader;
    const route: RouteWithRiskContext = {
      routeId: 'route-a',
      summaryLabel: 'Route A',
      distanceMeters: 1_000,
      distanceText: '1 km',
      durationSeconds: 600,
      durationText: '10 min',
      polyline: '',
      sampledPoints: [
        { lat: 6.9271, lng: 79.8612 },
        { lat: 6.928, lng: 79.862 },
      ],
      corridorRadiusMeters: 150,
      nearbyIncidentCount: 0,
      riskEvaluationStatus: 'ready_for_evaluation',
    };

    const result = await scoreRouteRisk(route, reader);

    expect(findWithinRadius).toHaveBeenCalledTimes(2);
    expect(result.riskFactors.incidentCount).toBe(2);
    expect(result.riskFactors.severityWeightedScore).toBeGreaterThan(0);
  });
});
