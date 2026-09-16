import { AppError } from '../../common/errors/app-error.js';
import type { DestinationSearchQuery, DestinationSuggestion } from './routes.types.js';

interface GeoapifyResult {
  place_id?: string;
  name?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  lat?: number;
  lon?: number;
  distance?: number;
}

export class GeocodingService {
  private readonly requestTimeoutMs = 5000;

  public constructor(
    private readonly apiKey?: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async searchPlaces(query: DestinationSearchQuery): Promise<DestinationSuggestion[]> {
    if (!this.apiKey) throw unavailableError();
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', query.q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '8');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('apiKey', this.apiKey);
    url.searchParams.set(
      'bias',
      query.lat !== undefined && query.lng !== undefined
        ? `proximity:${query.lng},${query.lat}|countrycode:lk`
        : 'countrycode:lk',
    );
    const payload = await this.requestGeoapify(url);
    const results = Array.isArray(payload.results) ? payload.results : [];
    return results.flatMap((entry: unknown): DestinationSuggestion[] => {
      const result = entry as GeoapifyResult;
      if (!result.place_id || typeof result.lat !== 'number' || typeof result.lon !== 'number') return [];
      const name = result.name ?? result.address_line1 ?? result.formatted;
      if (!name) return [];
      return [{
        id: result.place_id,
        name,
        address: result.address_line2 ?? result.formatted ?? '',
        latitude: result.lat,
        longitude: result.lon,
        ...(typeof result.distance === 'number' ? { distanceMeters: result.distance } : {}),
      }];
    }).slice(0, 8);
  }

  private async requestGeoapify(url: URL): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.request(url.toString(), { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw unavailableError();
      const payload: unknown = await response.json();
      if (typeof payload !== 'object' || payload === null) throw unavailableError();
      return payload as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }
}

function unavailableError(): AppError {
  return new AppError({
    statusCode: 503,
    code: 'DESTINATION_SEARCH_UNAVAILABLE',
    message: 'Destination search is temporarily unavailable. Please try again.',
  });
}
