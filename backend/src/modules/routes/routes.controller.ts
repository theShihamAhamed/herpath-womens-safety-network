import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { GeocodingService } from './geocoding.service.js';
import type { DestinationSearchQueryInput } from './routes.validation.js';

export class RoutesController {
  public constructor(private readonly geocodingService: GeocodingService) {}

  public searchDestinations = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = request.query as unknown as DestinationSearchQueryInput;
      const destinations = await this.geocodingService.searchPlaces(query);
      sendSuccess(response, destinations);
    } catch (error) {
      next(error);
    }
  };
}
