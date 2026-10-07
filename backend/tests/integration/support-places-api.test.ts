import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/common/errors/app-error.js';
import { errorHandler } from '../../src/common/middleware/error-handler.js';
import { createMapRouter } from '../../src/modules/map/map.routes.js';
import type { SupportPlaceProvider } from '../../src/modules/map/support-place.provider.js';

function createSupportPlaceApp(provider: SupportPlaceProvider) {
  const app = express();
  app.use('/map', createMapRouter({ supportPlaceProvider: provider }));
  app.use(errorHandler);
  return app;
}

describe('nearby support-place Map API', () => {
  it('returns only normalized provider places through the Map envelope', async () => {
    const app = createSupportPlaceApp({
      findNearby: async () => [
        {
          id: 'way/45',
          name: 'Community Hospital',
          category: 'MEDICAL',
          location: { latitude: 6.928, longitude: 79.862 },
        },
      ],
    });

    const response = await request(app)
      .get('/map/support-places')
      .query({ latitude: 6.9271, longitude: 79.8612, radius: 500 })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: 'way/45',
          name: 'Community Hospital',
          category: 'MEDICAL',
          location: { latitude: 6.928, longitude: 79.862 },
        },
      ],
      meta: {},
    });
  });

  it('rejects invalid and excessive nearby-search parameters before calling the provider', async () => {
    let called = false;
    const app = createSupportPlaceApp({
      findNearby: async () => {
        called = true;
        return [];
      },
    });

    await request(app)
      .get('/map/support-places')
      .query({ latitude: 6.9271, longitude: 79.8612, radius: 5_001 })
      .expect(400);

    expect(called).toBe(false);
  });

  it('returns provider unavailability rather than synthetic data', async () => {
    const app = createSupportPlaceApp({
      findNearby: async () => {
        throw new AppError({
          statusCode: 503,
          code: 'SUPPORT_PLACE_PROVIDER_UNAVAILABLE',
          message: 'Nearby support place data is unavailable',
        });
      },
    });

    const response = await request(app)
      .get('/map/support-places')
      .query({ latitude: 6.9271, longitude: 79.8612 })
      .expect(503);

    expect(response.body.data).toBeUndefined();
    expect(response.body.error.code).toBe('SUPPORT_PLACE_PROVIDER_UNAVAILABLE');
  });
});
