import type { Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { MapService } from './map.service.js';
import type { AreaSummaryQuery, ViewportQuery } from './map.types.js';
import type { SupportPlaceQuery } from './map.types.js';
import type { SupportPlaceService } from './support-place.service.js';
import type { GeoapifyTileService, TileCoordinates } from './geoapify-tile.service.js';

export class MapController {
  public constructor(
    private readonly mapService: MapService,
    private readonly supportPlaces: SupportPlaceService,
    private readonly tiles: GeoapifyTileService,
  ) {}

  public getIncidents = async (request: Request, response: Response): Promise<void> => {
    const query = request.query as unknown as ViewportQuery;
    const incidents = await this.mapService.getPublicIncidentsInViewport(query);
    sendSuccess(response, incidents);
  };

  public getAreaSummary = async (request: Request, response: Response): Promise<void> => {
    const query = request.query as unknown as AreaSummaryQuery;
    const summary = await this.mapService.getAreaSummary(query);
    sendSuccess(response, summary);
  };

  public getSupportPlaces = async (request: Request, response: Response): Promise<void> => {
    const query = request.query as unknown as SupportPlaceQuery;
    const places = await this.supportPlaces.findNearby(query);
    sendSuccess(response, places);
  };

  public getTile = async (request: Request, response: Response): Promise<void> => {
    const tile = await this.tiles.getRasterTile(request.params as unknown as TileCoordinates);
    response
      .set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
      .type(tile.contentType)
      .send(tile.body);
  };
}
