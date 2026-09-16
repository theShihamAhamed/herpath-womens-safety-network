import { AppError } from '../../common/errors/app-error.js';
import type { Destination, DestinationDetailsQuery, DestinationSearchQuery, DestinationSuggestion } from './routes.types.js';

export class GeocodingService {
  private readonly requestTimeoutMs = 5000;

  public constructor(
    private readonly apiKey?: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async searchPlaces(query: DestinationSearchQuery): Promise<DestinationSuggestion[]> {
    const body: Record<string, unknown> = {
      input: query.q,
      sessionToken: query.sessionToken,
      regionCode: 'LK',
    };
    if (query.lat !== undefined && query.lng !== undefined) {
      const point = { latitude: query.lat, longitude: query.lng };
      body.locationBias = { circle: { center: point, radius: 15_000 } };
      body.origin = point;
    }
    const payload = await this.requestGoogle('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.distanceMeters' },
    });
    const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
    return suggestions.flatMap((entry: unknown): DestinationSuggestion[] => {
      const prediction = typeof entry === 'object' && entry !== null ? (entry as { placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; distanceMeters?: number } }).placePrediction : undefined;
      if (!prediction?.placeId || !prediction?.text?.text) return [];
      return [{ id: prediction.placeId, placeId: prediction.placeId, name: prediction.structuredFormat?.mainText?.text ?? prediction.text.text, address: prediction.structuredFormat?.secondaryText?.text ?? '', ...(typeof prediction.distanceMeters === 'number' ? { distanceMeters: prediction.distanceMeters } : {}) }];
    }).slice(0, 8);
  }

  public async getPlaceDetails(query: DestinationDetailsQuery): Promise<Destination> {
    const payload = await this.requestGoogle(`https://places.googleapis.com/v1/places/${encodeURIComponent(query.placeId)}?sessionToken=${encodeURIComponent(query.sessionToken)}`, { headers: { 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location' } });
    const detail = payload as { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } };
    if (!detail.id || !detail.displayName?.text || typeof detail.location?.latitude !== 'number' || typeof detail.location?.longitude !== 'number') throw unavailableError();
    return { id: detail.id, name: detail.displayName.text, address: detail.formattedAddress ?? '', latitude: detail.location.latitude, longitude: detail.location.longitude };
  }

  private async requestGoogle(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    if (!this.apiKey) throw unavailableError();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.request(url, { ...init, headers: { Accept: 'application/json', 'X-Goog-Api-Key': this.apiKey, ...init.headers }, signal: controller.signal });
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

function unavailableError(): AppError {
  return new AppError({
    statusCode: 503,
    code: 'DESTINATION_SEARCH_UNAVAILABLE',
    message: 'Destination search is temporarily unavailable. Please try again.',
  });
}
