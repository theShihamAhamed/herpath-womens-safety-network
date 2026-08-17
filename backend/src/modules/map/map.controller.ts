import type { Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { MapService } from './map.service.js';
import type { AreaSummaryQuery, ViewportQuery } from './map.types.js';

export class MapController {
  public constructor(private readonly mapService: MapService) {}

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
}
