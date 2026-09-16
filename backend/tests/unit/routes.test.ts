import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import type { AppError } from '../../src/common/errors/app-error.js';
import { GeocodingService } from '../../src/modules/routes/geocoding.service.js';
import { RoutesController } from '../../src/modules/routes/routes.controller.js';
import { destinationDetailsQuerySchema, destinationSearchQuerySchema } from '../../src/modules/routes/routes.validation.js';
import type { PublicIncidentReader } from '../../src/modules/incidents/incident.public-reader.js';
import type { PublicIncident } from '../../src/modules/incidents/incident.public.js';
import { prepareRoutesForRiskEvaluation } from '../../src/modules/routes/routeRisk.service.js';
import { scoreRouteRisk } from '../../src/modules/routes/riskScoring.service.js';
import type { RouteWithRiskContext } from '../../src/modules/routes/routes.types.js';

const sessionToken = '123e4567-e89b-42d3-a456-426614174000';

describe('destination search validation contracts', () => {
  it('accepts valid query strings with optional coordinates', () => {
    const validQuery = destinationSearchQuerySchema.parse({
      q: 'Colombo Fort',
      sessionToken,
      lat: 6.9344,
      lng: 79.8501,
    });

    expect(validQuery).toEqual({
      q: 'Colombo Fort',
      sessionToken,
      lat: 6.9344,
      lng: 79.8501,
    });
  });

  it('trims whitespace and accepts valid single-parameter search query', () => {
    const validQuery = destinationSearchQuerySchema.parse({
      q: '  Galle Face Green  ',
      sessionToken,
    });

    expect(validQuery.q).toBe('Galle Face Green');
  });

  it('accepts one-character autocomplete queries and rejects blank input', () => {
    expect(destinationSearchQuerySchema.parse({ q: 'a', sessionToken }).q).toBe('a');
    expect(() => destinationSearchQuerySchema.parse({ q: '   ', sessionToken })).toThrow();
  });

  it('requires a UUID session token for autocomplete and details', () => {
    expect(() => destinationSearchQuerySchema.parse({ q: 'a' })).toThrow();
    expect(destinationDetailsQuerySchema.parse({ placeId: 'place-1', sessionToken })).toEqual({
      placeId: 'place-1',
      sessionToken,
    });
  });

  it('rejects queries exceeding max character limit', () => {
    const longQuery = 'x'.repeat(101);
    expect(() => destinationSearchQuerySchema.parse({ q: longQuery, sessionToken })).toThrow(
      /not exceed 100 characters/,
    );
  });

  it('rejects out-of-range coordinates', () => {
    expect(() =>
      destinationSearchQuerySchema.parse({ q: 'Test', sessionToken, lat: 95, lng: 80 }),
    ).toThrow();
    expect(() =>
      destinationSearchQuerySchema.parse({ q: 'Test', sessionToken, lat: 6, lng: 190 }),
    ).toThrow();
  });
});

describe('GeocodingService retrieval', () => {
  it('returns normalized real provider results and biases them around real location', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ suggestions: [{ placePrediction: { placeId: 'place-1', text: { text: 'Colombo Fort' }, structuredFormat: { mainText: { text: 'Colombo Fort' }, secondaryText: { text: 'Colombo, Sri Lanka' } }, distanceMeters: 320 } }] }), { status: 200 }));
    const service = new GeocodingService('test-key', request);

    await expect(service.searchPlaces({ q: 'Colombo Fort', sessionToken, lat: 6.9, lng: 79.8 })).resolves.toEqual([
      {
        id: 'place-1', placeId: 'place-1', name: 'Colombo Fort',
        address: 'Colombo, Sri Lanka',
        distanceMeters: 320,
      },
    ]);
    const requestBody = JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(requestBody).toMatchObject({
      input: 'Colombo Fort',
      sessionToken,
      regionCode: 'LK',
      origin: { latitude: 6.9, longitude: 79.8 },
      locationBias: { circle: { center: { latitude: 6.9, longitude: 79.8 }, radius: 15_000 } },
    });
  });

  it('returns an empty array for a successful empty provider response without fabricating places', async () => {
    const service = new GeocodingService(
      'test-key',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ suggestions: [] }), { status: 200 })),
    );

    await expect(service.searchPlaces({ q: 'zzz', sessionToken })).resolves.toEqual([]);
  });

  it('resolves a selected prediction through Place Details using the same session', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'place-1', displayName: { text: 'Colombo Fort' }, formattedAddress: 'Colombo, Sri Lanka',
      location: { latitude: 6.9344, longitude: 79.8501 },
    }), { status: 200 }));
    const service = new GeocodingService('test-key', request);

    await expect(service.getPlaceDetails({ placeId: 'place-1', sessionToken })).resolves.toEqual({
      id: 'place-1', name: 'Colombo Fort', address: 'Colombo, Sri Lanka', latitude: 6.9344, longitude: 79.8501,
    });
    expect(request.mock.calls[0]?.[0]).toContain(`places/place-1?sessionToken=${sessionToken}`);
  });

  it('reports provider failure instead of returning a synthetic destination', async () => {
    const request = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    const service = new GeocodingService('test-key', request);

    await expect(service.searchPlaces({ q: 'Custom Safe Hub', sessionToken })).rejects.toMatchObject({
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
