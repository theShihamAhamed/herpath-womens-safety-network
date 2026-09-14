export const SUPPORT_PLACE_CATEGORIES = [
  'POLICE',
  'MEDICAL',
  'EMERGENCY',
  'WOMENS_SUPPORT',
  'COUNSELLING_SUPPORT',
] as const;

export type SupportPlaceCategory = (typeof SUPPORT_PLACE_CATEGORIES)[number];

/** A public, provider-neutral nearby support resource. */
export interface SupportPlace {
  id: string;
  name: string;
  category: SupportPlaceCategory;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface SupportPlaceSearchQuery {
  latitude: number;
  longitude: number;
  radius: number;
}
