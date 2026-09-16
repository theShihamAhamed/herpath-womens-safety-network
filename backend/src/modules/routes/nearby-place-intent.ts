export interface NearbyPlaceIntent { category: string; }

const categories: Record<string, string> = {
  hospital: 'healthcare.hospital', clinic: 'healthcare.clinic_or_praxis', pharmacy: 'healthcare.pharmacy',
  laundry: 'service.cleaning.laundry', 'dry cleaning': 'service.cleaning.dry_cleaning',
  bank: 'service.financial.bank', atm: 'service.financial.atm', restaurant: 'catering.restaurant',
  pizza: 'catering.restaurant.pizza,catering.fast_food.pizza', cafe: 'catering.cafe',
  supermarket: 'commercial.supermarket', 'fuel station': 'service.vehicle.fuel',
  'petrol station': 'service.vehicle.fuel', 'gas station': 'service.vehicle.fuel',
  school: 'education.school', university: 'education.university', hotel: 'accommodation.hotel', police: 'service.police',
};

export function parseNearbyPlaceIntent(query: string): NearbyPlaceIntent | null {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized.endsWith(' near me')) return null;
  const intent = normalized.slice(0, -' near me'.length).trim();
  const category = categories[intent];
  return category ? { category } : null;
}
