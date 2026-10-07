import { AppError } from '../../common/errors/app-error.js';

const GEOAPIFY_TILE_STYLE = 'osm-liberty';
const GEOAPIFY_TILE_BASE_URL = 'https://maps.geoapify.com/v1/tile';

export interface TileCoordinates {
  z: number;
  x: number;
  y: number;
}

export interface RasterTile {
  body: Buffer;
  contentType: 'image/png';
}

export class GeoapifyTileService {
  public constructor(
    private readonly apiKey?: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async getRasterTile({ z, x, y }: TileCoordinates): Promise<RasterTile> {
    if (!this.apiKey) {
      throw unavailableError();
    }

    const url = new URL(`${GEOAPIFY_TILE_BASE_URL}/${GEOAPIFY_TILE_STYLE}/${z}/${x}/${y}.png`);
    url.searchParams.set('apiKey', this.apiKey);

    let response: Response;
    try {
      response = await this.request(url, { headers: { Accept: 'image/png' } });
    } catch {
      throw unavailableError();
    }

    if (response.status === 404) {
      throw new AppError({ statusCode: 404, code: 'MAP_TILE_NOT_FOUND', message: 'Map tile was not found' });
    }
    if (response.status === 429) {
      throw new AppError({ statusCode: 429, code: 'MAP_TILES_RATE_LIMITED', message: 'Map tiles are temporarily rate limited' });
    }
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('image/png')) {
      throw unavailableError();
    }

    return { body: Buffer.from(await response.arrayBuffer()), contentType: 'image/png' };
  }
}

function unavailableError(): AppError {
  return new AppError({ statusCode: 503, code: 'MAP_TILES_UNAVAILABLE', message: 'Map tiles are temporarily unavailable' });
}
