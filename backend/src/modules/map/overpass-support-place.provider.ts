import { AppError } from '../../common/errors/app-error.js';
import type { SupportPlaceProvider } from './support-place.provider.js';
import type {
  SupportPlace,
  SupportPlaceCategory,
  SupportPlaceSearchQuery,
} from './support-place.types.js';

export const DEFAULT_OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = 'HerPath-Womens-Safety-Network/1.0 (support-place-data)';

type OsmElementType = 'node' | 'way' | 'relation';

interface OverpassElement {
  type: OsmElementType;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
}

interface OverpassResponse {
  elements?: unknown;
}

export class OverpassSupportPlaceProvider implements SupportPlaceProvider {
  public constructor(
    private readonly endpoint = DEFAULT_OVERPASS_API_URL,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async findNearby(query: SupportPlaceSearchQuery): Promise<SupportPlace[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await this.request(this.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': USER_AGENT,
        },
        body: new URLSearchParams({ data: buildOverpassQuery(query) }).toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw unavailableError(response.status);
      }

      return normalizeOverpassResponse(await response.json());
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildOverpassQuery(query: SupportPlaceSearchQuery): string {
  const around = `around:${query.radius},${query.latitude},${query.longitude}`;

  return `[out:json][timeout:15];
(
  nwr(${around})["amenity"="police"];
  nwr(${around})["amenity"="hospital"];
  nwr(${around})["amenity"="clinic"];
  nwr(${around})["amenity"="fire_station"];
  nwr(${around})["emergency"="ambulance_station"];
  nwr(${around})["amenity"="social_facility"]["social_facility"~"^(shelter|outreach)$"]["social_facility:for"="woman"];
  nwr(${around})["healthcare"="counselling"];
  nwr(${around})["amenity"="social_facility"]["social_facility"="outreach"]["social_facility:for"~"^(abused|victim|mental_health)$"];
);
out center;`;
}

export function normalizeOverpassResponse(payload: unknown): SupportPlace[] {
  if (!isOverpassResponse(payload)) {
    throw unavailableError();
  }

  const places = new Map<string, SupportPlace>();
  for (const value of payload.elements) {
    if (!isOverpassElement(value)) continue;
    const place = normalizeElement(value);
    if (place) places.set(place.id, place);
  }

  return [...places.values()];
}

function normalizeElement(element: OverpassElement): SupportPlace | null {
  const category = categoryForTags(element.tags ?? {});
  const name = element.tags?.name?.trim();
  const coordinates = coordinatesForElement(element);
  if (!category || !name || !coordinates) return null;

  return {
    id: `${element.type}/${element.id}`,
    name,
    category,
    location: coordinates,
  };
}

export function categoryForTags(tags: Record<string, string | undefined>): SupportPlaceCategory | null {
  if (tags.amenity === 'police') return 'POLICE';
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic') return 'MEDICAL';
  if (tags.amenity === 'fire_station' || tags.emergency === 'ambulance_station') {
    return 'EMERGENCY';
  }
  if (
    tags.amenity === 'social_facility' &&
    (tags.social_facility === 'shelter' || tags.social_facility === 'outreach') &&
    tags['social_facility:for'] === 'woman'
  ) {
    return 'WOMENS_SUPPORT';
  }
  if (
    tags.healthcare === 'counselling' ||
    (tags.amenity === 'social_facility' &&
      tags.social_facility === 'outreach' &&
      ['abused', 'victim', 'mental_health'].includes(tags['social_facility:for'] ?? ''))
  ) {
    return 'COUNSELLING_SUPPORT';
  }

  return null;
}

function coordinatesForElement(element: OverpassElement): SupportPlace['location'] | null {
  const latitude = element.type === 'node' ? element.lat : element.center?.lat;
  const longitude = element.type === 'node' ? element.lon : element.center?.lon;
  if (!isLatitude(latitude) || !isLongitude(longitude)) return null;

  return { latitude, longitude };
}

function isOverpassResponse(value: unknown): value is OverpassResponse & { elements: unknown[] } {
  return typeof value === 'object' && value !== null && Array.isArray((value as OverpassResponse).elements);
}

function isOverpassElement(value: unknown): value is OverpassElement {
  if (typeof value !== 'object' || value === null) return false;
  const element = value as Partial<OverpassElement>;
  return (
    (element.type === 'node' || element.type === 'way' || element.type === 'relation') &&
    typeof element.id === 'number'
  );
}

function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

function unavailableError(status?: number): AppError {
  return new AppError({
    statusCode: 503,
    code: 'SUPPORT_PLACE_PROVIDER_UNAVAILABLE',
    message:
      status === 429
        ? 'Nearby support place data is temporarily unavailable'
        : 'Nearby support place data is unavailable',
  });
}
