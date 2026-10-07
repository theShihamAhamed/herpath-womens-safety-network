import { OverpassSupportPlaceProvider } from './overpass-support-place.provider.js';
import type { SupportPlaceProvider } from './support-place.provider.js';
import type { SupportPlace, SupportPlaceSearchQuery } from './support-place.types.js';

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 100;

/**
 * Bounds interactive-map provider traffic with short-lived spatial caching and
 * in-flight request sharing. This process-local cache is deliberately small.
 */
export class SupportPlaceService {
  private readonly cache = new Map<string, { expiresAt: number; places: SupportPlace[] }>();
  private readonly inFlight = new Map<string, Promise<SupportPlace[]>>();

  public constructor(private readonly provider: SupportPlaceProvider = new OverpassSupportPlaceProvider()) {}

  public async findNearby(query: SupportPlaceSearchQuery): Promise<SupportPlace[]> {
    const key = cacheKey(query);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.places;
    if (cached) this.cache.delete(key);

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.provider.findNearby(query).then((places) => {
      if (this.cache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, places });
      return places;
    });
    this.inFlight.set(key, request);

    try {
      return await request;
    } finally {
      this.inFlight.delete(key);
    }
  }
}

function cacheKey(query: SupportPlaceSearchQuery): string {
  return [query.latitude.toFixed(3), query.longitude.toFixed(3), query.radius, 'v1'].join(':');
}
