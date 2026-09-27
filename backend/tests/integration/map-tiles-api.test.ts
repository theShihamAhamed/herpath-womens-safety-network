import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../src/common/middleware/error-handler.js';
import { createMapRouter } from '../../src/modules/map/map.routes.js';

function createTileApp(apiKey: string | undefined, tileRequest: typeof fetch) {
  const app = express();
  app.use('/map', createMapRouter({ geoapifyApiKey: apiKey, tileRequest }));
  app.use(errorHandler);
  return app;
}

describe('Geoapify raster tile proxy', () => {
  it('returns a cached PNG without exposing the server-side key', async () => {
    const tileRequest = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } }),
    );
    const response = await request(createTileApp('server-only-key', tileRequest))
      .get('/map/tiles/1/1/0')
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', /max-age=3600/)
      .expect(200);

    expect(response.body.toString('utf8')).not.toContain('server-only-key');
    const upstreamUrl = new URL(tileRequest.mock.calls[0]?.[0] as string);
    expect(upstreamUrl.pathname).toBe('/v1/tile/osm-liberty/1/1/0.png');
    expect(upstreamUrl.searchParams.get('apiKey')).toBe('server-only-key');
  });

  it('rejects invalid tile coordinates before fetching upstream', async () => {
    const tileRequest = vi.fn<typeof fetch>();
    const response = await request(createTileApp('server-only-key', tileRequest)).get('/map/tiles/1/2/0').expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(tileRequest).not.toHaveBeenCalled();
  });

  it('fails safely when the key is unavailable', async () => {
    const response = await request(createTileApp(undefined, vi.fn<typeof fetch>())).get('/map/tiles/1/1/0').expect(503);

    expect(response.body.error).toMatchObject({ code: 'MAP_TILES_UNAVAILABLE', message: 'Map tiles are temporarily unavailable' });
  });

  it('returns a safe error for an upstream rate limit', async () => {
    const tileRequest = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    const response = await request(createTileApp('server-only-key', tileRequest)).get('/map/tiles/1/1/0').expect(429);

    expect(response.body.error.code).toBe('MAP_TILES_RATE_LIMITED');
  });
});
