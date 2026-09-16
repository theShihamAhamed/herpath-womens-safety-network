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

export interface GeoapifyCategoryMetadata {
  keys: string[];
  label?: string;
}

export interface GeoapifyAutocompleteResult {
  results: DestinationSuggestion[];
  categories: string[];
  categoryMetadata: GeoapifyCategoryMetadata[];
}

export interface DestinationSearchSources {
  autocompleteResults: DestinationSuggestion[];
  placesResults: DestinationSuggestion[];
  amenityResults: DestinationSuggestion[];
  categories: string[];
}

export function parseGeoapifyAutocompleteResponse(payload: Record<string, unknown>): GeoapifyAutocompleteResult {
  const results = Array.isArray(payload.results) ? payload.results : [];
  const categoryEntries = typeof payload.query === 'object' && payload.query !== null && Array.isArray((payload.query as { categories?: unknown }).categories)
    ? (payload.query as { categories: unknown[] }).categories
    : [];
  const categoryMetadata = categoryEntries.flatMap((entry): GeoapifyCategoryMetadata[] => {
    if (typeof entry === 'string') {
      const key = entry.trim();
      return key ? [{ keys: [key] }] : [];
    }
    if (typeof entry !== 'object' || entry === null || !Array.isArray((entry as { keys?: unknown }).keys)) return [];
    const keys = (entry as { keys: unknown[] }).keys
      .filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
      .map((key) => key.trim());
    if (keys.length === 0) return [];
    const label = typeof (entry as { label?: unknown }).label === 'string'
      ? (entry as { label: string }).label.trim()
      : undefined;
    return [{ keys, ...(label ? { label } : {}) }];
  });
  return {
    results: normalizeGeoapifyResults(results),
    categories: categoryMetadata.flatMap((category) => category.keys),
    categoryMetadata,
  };
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
    const sources = await this.searchDestinationSources(query);
    return mergeDestinationSuggestions(
      sources.placesResults.length > 0 ? sources.placesResults : sources.amenityResults,
      sources.autocompleteResults,
    );
  }

  public async searchDestinationSources(query: DestinationSearchQuery): Promise<DestinationSearchSources> {
    if (!this.apiKey) throw unavailableError();
    const searchText = query.q.replace(/\s+near\s+me\s*$/i, '').trim();
    if (!searchText) return { autocompleteResults: [], placesResults: [], amenityResults: [], categories: [] };
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', searchText);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '8');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('apiKey', this.apiKey);
    if (query.lat !== undefined && query.lng !== undefined) {
      url.searchParams.set('bias', `proximity:${query.lng},${query.lat}`);
    }
    const autocomplete = await this.searchAutocomplete(url);
    const category = selectRelevantGeoapifyCategory(searchText, autocomplete.categoryMetadata);
    const hasLocation = query.lat !== undefined && query.lng !== undefined;
    const placesResults = category && query.lat !== undefined && query.lng !== undefined
      ? await this.searchNearbyPlaces(category, query.lat, query.lng, { requireMeaningfulName: true })
      : [];
    const shouldUseAmenityFallback = searchText.length >= 3
      && (!category || (hasLocation && placesResults.length === 0));
    const amenityResults = shouldUseAmenityFallback
      ? await this.searchAmenityAutocomplete(query.q.trim(), query.lat, query.lng)
      : [];
    return { autocompleteResults: autocomplete.results, placesResults, amenityResults, categories: autocomplete.categories };
  }

  private async searchNearbyPlaces(
    category: string,
    latitude: number,
    longitude: number,
    options: { requireMeaningfulName?: boolean } = {},
  ): Promise<DestinationSuggestion[]> {
    const url = new URL('https://api.geoapify.com/v2/places');
    url.searchParams.set('categories', category);
    url.searchParams.set('bias', `proximity:${longitude},${latitude}`);
    url.searchParams.set('limit', '8');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('apiKey', this.apiKey!);
    const payload = await this.requestGeoapify(url);
    const features = Array.isArray(payload.features) ? payload.features : [];
    return normalizeGeoapifyPlaceFeatures(features, options);
  }

  private normalizeResults(results: unknown[]): DestinationSuggestion[] {
    return normalizeGeoapifyResults(results);
  }

  private async searchAutocomplete(url: URL): Promise<GeoapifyAutocompleteResult> {
    return parseGeoapifyAutocompleteResponse(await this.requestGeoapify(url));
  }

  private async searchAmenityAutocomplete(
    searchText: string,
    latitude?: number,
    longitude?: number,
  ): Promise<DestinationSuggestion[]> {
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', searchText);
    url.searchParams.set('type', 'amenity');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '8');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('apiKey', this.apiKey!);
    if (latitude !== undefined && longitude !== undefined) {
      url.searchParams.set('bias', `proximity:${longitude},${latitude}`);
    }
    return (await this.searchAutocomplete(url)).results;
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

export function selectRelevantGeoapifyCategory(
  query: string,
  categories: GeoapifyCategoryMetadata[],
): string | undefined {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return undefined;
  if (normalizedQuery.length < 3) return categories.flatMap((category) => category.keys)[0];
  for (const category of categories) {
    const labelTokens = tokenizeCategoryText(category.label ?? '');
    for (const key of category.keys) {
      const tokens = [...labelTokens, ...tokenizeCategoryText(key)];
      if (tokens.some((token) => token.startsWith(normalizedQuery))) return key;
    }
  }
  return undefined;
}

function tokenizeCategoryText(value: string): string[] {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3);
}

function normalizeGeoapifyPlaceFeatures(
  features: unknown[],
  options: { requireMeaningfulName?: boolean },
): DestinationSuggestion[] {
  return features.flatMap((entry: unknown): DestinationSuggestion[] => {
    const feature = entry as { properties?: GeoapifyResult; geometry?: { coordinates?: unknown[] } };
    const properties = feature.properties;
    const coordinates = feature.geometry?.coordinates;
    const longitudeValue = typeof properties?.lon === 'number' ? properties.lon : coordinates?.[0];
    const latitudeValue = typeof properties?.lat === 'number' ? properties.lat : coordinates?.[1];
    if (!properties?.place_id || typeof latitudeValue !== 'number' || typeof longitudeValue !== 'number') return [];
    const providerName = typeof properties.name === 'string' && properties.name.trim() ? properties.name.trim() : undefined;
    if (options.requireMeaningfulName && !providerName) return [];
    const name = providerName ?? properties.address_line1 ?? properties.formatted;
    if (!name) return [];
    return [{ id: properties.place_id, name, address: properties.address_line2 ?? properties.formatted ?? '', latitude: latitudeValue, longitude: longitudeValue, ...(typeof properties.distance === 'number' ? { distanceMeters: properties.distance } : {}) }];
  }).slice(0, 8);
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

function mergeDestinationSuggestions(
  placesResults: DestinationSuggestion[],
  autocompleteResults: DestinationSuggestion[],
): DestinationSuggestion[] {
  const seen = new Set<string>();
  return [...placesResults, ...autocompleteResults].filter((suggestion) => {
    const identity = `${suggestion.name.trim().toLowerCase()}|${suggestion.latitude}|${suggestion.longitude}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
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
