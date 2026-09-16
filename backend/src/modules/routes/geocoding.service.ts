import { AppError } from '../../common/errors/app-error.js';
import type { DestinationSearchQuery, DestinationSuggestion } from './routes.types.js';
import { parseNearbyPlaceIntent } from './nearby-place-intent.js';

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

export interface GeoapifyAutocompleteResult {
  results: DestinationSuggestion[];
  categories: string[];
}

export function parseGeoapifyAutocompleteResponse(payload: Record<string, unknown>): GeoapifyAutocompleteResult {
  const results = Array.isArray(payload.results) ? payload.results : [];
  const categories = typeof payload.query === 'object' && payload.query !== null && Array.isArray((payload.query as { categories?: unknown }).categories)
    ? (payload.query as { categories: unknown[] }).categories.filter((category): category is string => typeof category === 'string')
    : [];
  return { results: normalizeGeoapifyResults(results), categories };
}

export class GeocodingService {
  private readonly requestTimeoutMs = 5000;

  public constructor(
    private readonly apiKey?: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async searchPlaces(query: DestinationSearchQuery): Promise<DestinationSuggestion[]> {
    if (!this.apiKey) throw unavailableError();
    const nearbyIntent = parseNearbyPlaceIntent(query.q);
    if (nearbyIntent) {
      if (query.lat === undefined || query.lng === undefined) throw locationRequiredError();
      return this.searchNearbyPlaces(nearbyIntent.category, query.lat, query.lng);
    }
    const searchText = query.q.replace(/\s+near\s+me\s*$/i, '').trim();
    if (!searchText) return [];
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', searchText);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '8');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('apiKey', this.apiKey);
    if (query.lat !== undefined && query.lng !== undefined) {
      url.searchParams.set('bias', `proximity:${query.lng},${query.lat}`);
    }
    return (await this.searchAutocomplete(url)).results;
  }

  private async searchNearbyPlaces(category: string, latitude: number, longitude: number): Promise<DestinationSuggestion[]> {
    const url = new URL('https://api.geoapify.com/v2/places');
    url.searchParams.set('categories', category);
    url.searchParams.set('bias', `proximity:${longitude},${latitude}`);
    url.searchParams.set('limit', '8');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('apiKey', this.apiKey!);
    const payload = await this.requestGeoapify(url);
    const features = Array.isArray(payload.features) ? payload.features : [];
    return features.flatMap((entry: unknown): DestinationSuggestion[] => {
      const feature = entry as { properties?: GeoapifyResult; geometry?: { coordinates?: unknown[] } };
      const properties = feature.properties;
      const coordinates = feature.geometry?.coordinates;
      const longitudeValue = typeof properties?.lon === 'number' ? properties.lon : coordinates?.[0];
      const latitudeValue = typeof properties?.lat === 'number' ? properties.lat : coordinates?.[1];
      if (!properties?.place_id || typeof latitudeValue !== 'number' || typeof longitudeValue !== 'number') return [];
      const name = properties.name ?? properties.address_line1 ?? properties.formatted;
      if (!name) return [];
      return [{ id: properties.place_id, name, address: properties.address_line2 ?? properties.formatted ?? '', latitude: latitudeValue, longitude: longitudeValue, ...(typeof properties.distance === 'number' ? { distanceMeters: properties.distance } : {}) }];
    }).slice(0, 8);
  }

  private normalizeResults(results: unknown[]): DestinationSuggestion[] {
    return normalizeGeoapifyResults(results);
  }

  private async searchAutocomplete(url: URL): Promise<GeoapifyAutocompleteResult> {
    return parseGeoapifyAutocompleteResponse(await this.requestGeoapify(url));
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
    } finally { clearTimeout(timeout); }
  }

}

function normalizeGeoapifyResults(results: unknown[]): DestinationSuggestion[] {
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

function unavailableError(): AppError {
  return new AppError({
    statusCode: 503,
    code: 'DESTINATION_SEARCH_UNAVAILABLE',
    message: 'Destination search is temporarily unavailable. Please try again.',
  });
}

function locationRequiredError(): AppError {
  return new AppError({ statusCode: 422, code: 'DESTINATION_LOCATION_REQUIRED', message: 'Your location is needed to find places near you.' });
}
