import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { GeocodingService } from '../../src/modules/routes/geocoding.service.js';
import { RoutesController } from '../../src/modules/routes/routes.controller.js';
import { destinationSearchQuerySchema } from '../../src/modules/routes/routes.validation.js';
import type { PublicIncidentReader } from '../../src/modules/incidents/incident.public-reader.js';
import type { PublicIncident } from '../../src/modules/incidents/incident.public.js';
import { prepareRoutesForRiskEvaluation } from '../../src/modules/routes/routeRisk.service.js';
import { scoreRouteRisk } from '../../src/modules/routes/riskScoring.service.js';
import type { RouteWithRiskContext } from '../../src/modules/routes/routes.types.js';

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

  it('rejects search queries that are too short (< 2 chars)', () => {
    expect(() => destinationSearchQuerySchema.parse({ q: 'a' })).toThrow(
      /at least 2 characters/,
    );
    expect(() => destinationSearchQuerySchema.parse({ q: '   ' })).toThrow();
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

describe('GeocodingService fallback & retrieval', () => {
  it('returns curated matching destinations for common places', async () => {
    const service = new GeocodingService();
    const results = await service.searchPlaces({ q: 'Colombo Fort' });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      name: expect.stringContaining('Colombo Fort'),
      latitude: expect.any(Number),
      longitude: expect.any(Number),
    });
  });

  it('returns synthetic destination fallback if no predefined place matches', async () => {
    const service = new GeocodingService();
    const results = await service.searchPlaces({ q: 'Custom Safe Hub' });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Custom Safe Hub');
    expect(results[0].latitude).toBeDefined();
    expect(results[0].longitude).toBeDefined();
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
