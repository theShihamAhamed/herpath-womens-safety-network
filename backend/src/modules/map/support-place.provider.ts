import type { SupportPlace, SupportPlaceSearchQuery } from './support-place.types.js';

/** Map-owned boundary for real nearby support-place data sources. */
export interface SupportPlaceProvider {
  findNearby(query: SupportPlaceSearchQuery): Promise<SupportPlace[]>;
}
