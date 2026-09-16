import { AppError } from '../../common/errors/app-error.js';
import type { Destination, DestinationSearchQuery } from './routes.types.js';

interface NominatimPlace {
  place_id: number;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: {
    amenity?: string;
    building?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    state?: string;
    country?: string;
    [key: string]: string | undefined;
  };
}

export class GeocodingService {
  private readonly userAgent = 'HerPath-Womens-Safety-Network/1.0 (safety-network@herpath.app)';
  private readonly requestTimeoutMs = 4000;

  public constructor(
    private readonly endpoint = 'https://nominatim.openstreetmap.org/search',
    private readonly request: typeof fetch = fetch,
  ) {}

  public async searchPlaces(query: DestinationSearchQuery): Promise<Destination[]> {
    const trimmedQuery = query.q.trim();
    if (!trimmedQuery) {
      return [];
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const url = new URL(this.endpoint);
      url.searchParams.set('q', trimmedQuery);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '8');

      if (query.lat !== undefined && query.lng !== undefined) {
        // Bias search towards user's current location with a ~0.5 deg bounding box
        const delta = 0.25;
        const left = query.lng - delta;
        const bottom = query.lat - delta;
        const right = query.lng + delta;
        const top = query.lat + delta;
        url.searchParams.set('viewbox', `${left},${top},${right},${bottom}`);
      }

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      const response = await this.request(url.toString(), {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) throw unavailableError();

      const places = await response.json();
      if (!Array.isArray(places)) throw unavailableError();
      return places.map((place, index) => this.mapNominatimPlace(place as NominatimPlace, index));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailableError();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private mapNominatimPlace(place: NominatimPlace, index: number): Destination {
    const displayNameParts = place.display_name.split(',').map((part) => part.trim());
    const primaryName = place.name || displayNameParts[0] || 'Unknown Location';
    const address = displayNameParts.length > 1 ? displayNameParts.slice(1).join(', ') : place.display_name;

    return {
      id: place.place_id ? `osm-${place.place_id}` : `dest-${index}-${Date.now()}`,
      name: primaryName,
      address,
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
    };
  }

}

function unavailableError(): AppError {
  return new AppError({
    statusCode: 503,
    code: 'DESTINATION_SEARCH_UNAVAILABLE',
    message: 'Destination search is temporarily unavailable. Please try again.',
  });
}
