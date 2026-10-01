import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../src/common/errors/app-error.js';
import { getAlternativeRoutes } from '../../src/modules/routes/routes.controller.js';
import { getRouteRecommendationHandler } from '../../src/modules/routes/recommendation.controller.js';
import {
  latLngCoordinateSchema,
  latLngStringSchema,
  parseAndValidateLatLng,
  routeAlternativesQuerySchema,
  validateRouteRiskScore,
  validateRouteSummary,
  validateRouteWithRiskContext,
} from '../../src/modules/routes/routes.validation.js';

describe('Route Validation: Coordinates & Query Schemas', () => {
  describe('latLngCoordinateSchema', () => {
    it('accepts valid latitude and longitude numbers', () => {
      expect(latLngCoordinateSchema.parse({ lat: 6.9271, lng: 79.8612 })).toEqual({
        lat: 6.9271,
        lng: 79.8612,
      });
      expect(latLngCoordinateSchema.parse({ lat: -90, lng: -180 })).toEqual({
        lat: -90,
        lng: -180,
      });
      expect(latLngCoordinateSchema.parse({ lat: 90, lng: 180 })).toEqual({
        lat: 90,
        lng: 180,
      });
    });

    it('rejects latitude out of range [-90, 90]', () => {
      expect(() => latLngCoordinateSchema.parse({ lat: 90.1, lng: 79.8 })).toThrow();
      expect(() => latLngCoordinateSchema.parse({ lat: -90.1, lng: 79.8 })).toThrow();
    });

    it('rejects longitude out of range [-180, 180]', () => {
      expect(() => latLngCoordinateSchema.parse({ lat: 6.9, lng: 180.1 })).toThrow();
      expect(() => latLngCoordinateSchema.parse({ lat: 6.9, lng: -180.1 })).toThrow();
    });

    it('rejects non-numeric coordinate values', () => {
      expect(() => latLngCoordinateSchema.parse({ lat: '6.9', lng: 79.8 })).toThrow();
      expect(() => latLngCoordinateSchema.parse({ lat: NaN, lng: 79.8 })).toThrow();
    });
  });

  describe('latLngStringSchema', () => {
    it('accepts valid "lat,lng" string format within bounds', () => {
      expect(latLngStringSchema.parse('6.9271,79.8612')).toBe('6.9271,79.8612');
      expect(latLngStringSchema.parse(' -6.9271 , 79.8612 ')).toBe('-6.9271 , 79.8612');
    });

    it('rejects non-"lat,lng" formats', () => {
      expect(() => latLngStringSchema.parse('6.9271')).toThrow();
      expect(() => latLngStringSchema.parse('abc,def')).toThrow();
      expect(() => latLngStringSchema.parse('')).toThrow();
      expect(() => latLngStringSchema.parse('6.9271,79.8612,10.0')).toThrow();
    });

    it('rejects out of bounds coordinates inside string', () => {
      expect(() => latLngStringSchema.parse('95.0,79.8')).toThrow();
      expect(() => latLngStringSchema.parse('6.9,190.0')).toThrow();
    });
  });

  describe('routeAlternativesQuerySchema', () => {
    it('accepts valid origin, destination and optional mode', () => {
      const parsed = routeAlternativesQuerySchema.parse({
        origin: '6.9271,79.8612',
        destination: '6.9344,79.8501',
        mode: 'walking',
      });
      expect(parsed).toEqual({
        origin: '6.9271,79.8612',
        destination: '6.9344,79.8501',
        mode: 'walking',
      });
    });

    it('defaults mode to walking when omitted', () => {
      const parsed = routeAlternativesQuerySchema.parse({
        origin: '6.9271,79.8612',
        destination: '6.9344,79.8501',
      });
      expect(parsed.mode).toBe('walking');
    });

    it('rejects unknown transportation modes', () => {
      expect(() =>
        routeAlternativesQuerySchema.parse({
          origin: '6.9271,79.8612',
          destination: '6.9344,79.8501',
          mode: 'submarine' as unknown as 'walking',
        }),
      ).toThrow();
    });

    it('rejects missing origin or destination', () => {
      expect(() =>
        routeAlternativesQuerySchema.parse({
          destination: '6.9344,79.8501',
        }),
      ).toThrow();
      expect(() =>
        routeAlternativesQuerySchema.parse({
          origin: '6.9271,79.8612',
        }),
      ).toThrow();
    });
  });

  describe('parseAndValidateLatLng', () => {
    it('parses valid coordinate string into LatLng object', () => {
      expect(parseAndValidateLatLng('6.9271,79.8612')).toEqual({
        lat: 6.9271,
        lng: 79.8612,
      });
    });

    it('throws AppError INVALID_COORDINATES for non-string inputs', () => {
      expect(() => parseAndValidateLatLng(null)).toThrow(AppError);
      expect(() => parseAndValidateLatLng(undefined)).toThrow(AppError);
      expect(() => parseAndValidateLatLng(123)).toThrow(AppError);
    });

    it('throws AppError INVALID_COORDINATES for malformed string', () => {
      expect(() => parseAndValidateLatLng('single_value')).toThrow(AppError);
      expect(() => parseAndValidateLatLng('invalid,coords')).toThrow(AppError);
    });

    it('throws AppError INVALID_COORDINATES for out-of-bounds coordinates', () => {
      expect(() => parseAndValidateLatLng('91.0,79.8')).toThrow(AppError);
      expect(() => parseAndValidateLatLng('6.9,185.0')).toThrow(AppError);
    });
  });
});

describe('Route Validation: Data Models & Entities', () => {
  const validSummary = {
    routeId: 'route-test-1',
    summaryLabel: 'Via Main St',
    distanceMeters: 1500,
    distanceText: '1.5 km',
    durationSeconds: 1200,
    durationText: '20 min',
    polyline: 'w~liFvg`k@_ulLnnqC',
  };

  describe('routeSummarySchema & validateRouteSummary', () => {
    it('validates a complete and well-formed RouteSummary', () => {
      expect(validateRouteSummary(validSummary)).toEqual(validSummary);
    });

    it('rejects summary with negative distance or duration', () => {
      expect(() =>
        validateRouteSummary({ ...validSummary, distanceMeters: -50 }),
      ).toThrow(AppError);
      expect(() =>
        validateRouteSummary({ ...validSummary, durationSeconds: -10 }),
      ).toThrow(AppError);
    });

    it('rejects summary with missing required fields', () => {
      expect(() =>
        validateRouteSummary({ ...validSummary, routeId: '' }),
      ).toThrow(AppError);
      expect(() =>
        validateRouteSummary({ ...validSummary, polyline: '' }),
      ).toThrow(AppError);
      expect(() =>
        validateRouteSummary({ ...validSummary, summaryLabel: '' }),
      ).toThrow(AppError);
    });
  });

  describe('routeWithRiskContextSchema & validateRouteWithRiskContext', () => {
    const validWithRisk = {
      ...validSummary,
      sampledPoints: [
        { lat: 6.9271, lng: 79.8612 },
        { lat: 6.928, lng: 79.862 },
      ],
      corridorRadiusMeters: 150,
      nearbyIncidentCount: 2,
      riskEvaluationStatus: 'ready_for_evaluation' as const,
    };

    it('validates a complete RouteWithRiskContext', () => {
      expect(validateRouteWithRiskContext(validWithRisk)).toEqual(validWithRisk);
    });

    it('rejects negative nearbyIncidentCount or invalid status', () => {
      expect(() =>
        validateRouteWithRiskContext({ ...validWithRisk, nearbyIncidentCount: -1 }),
      ).toThrow(AppError);
      expect(() =>
        validateRouteWithRiskContext({
          ...validWithRisk,
          riskEvaluationStatus: 'invalid_status' as unknown as 'ready_for_evaluation',
        }),
      ).toThrow(AppError);
    });

    it('rejects invalid sampled point coordinates', () => {
      expect(() =>
        validateRouteWithRiskContext({
          ...validWithRisk,
          sampledPoints: [{ lat: 100, lng: 79.8612 }],
        }),
      ).toThrow(AppError);
    });
  });

  describe('routeRiskScoreSchema & validateRouteRiskScore', () => {
    const validRiskScore = {
      ...validSummary,
      sampledPoints: [{ lat: 6.9271, lng: 79.8612 }],
      corridorRadiusMeters: 150,
      nearbyIncidentCount: 1,
      riskEvaluationStatus: 'ready_for_evaluation' as const,
      riskScore: 0.75,
      riskFactors: {
        incidentCount: 1,
        severityWeightedScore: 0.8,
        recencyWeightedScore: 0.75,
      },
    };

    it('validates a complete RouteRiskScore', () => {
      expect(validateRouteRiskScore(validRiskScore)).toEqual(validRiskScore);
    });

    it('rejects negative riskScore or negative risk factors', () => {
      expect(() =>
        validateRouteRiskScore({ ...validRiskScore, riskScore: -1 }),
      ).toThrow(AppError);
      expect(() =>
        validateRouteRiskScore({
          ...validRiskScore,
          riskFactors: {
            ...validRiskScore.riskFactors,
            severityWeightedScore: -0.5,
          },
        }),
      ).toThrow(AppError);
    });
  });
});

describe('Route Controller Input Validation Handlers', () => {
  it('getAlternativeRoutes calls next with AppError on invalid coordinates', async () => {
    const req = { query: { origin: 'invalid', destination: '6.9,79.8' } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await getAlternativeRoutes(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INVALID_COORDINATES',
    }));
  });

  it('getRouteRecommendationHandler calls next with AppError on missing origin/destination', async () => {
    const req = { query: {} } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await getRouteRecommendationHandler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INVALID_COORDINATES',
    }));
  });
});
