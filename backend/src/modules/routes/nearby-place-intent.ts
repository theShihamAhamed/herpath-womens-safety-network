export interface NearbyPlaceIntent { category: string; }

const categories: Record<string, string> = {
  hospital: 'healthcare.hospital', hospitals: 'healthcare.hospital', clinic: 'healthcare.clinic_or_praxis', clinics: 'healthcare.clinic_or_praxis', pharmacy: 'healthcare.pharmacy', pharmacies: 'healthcare.pharmacy',
  laundry: 'service.cleaning.laundry', laundries: 'service.cleaning.laundry', 'dry cleaning': 'service.cleaning.dry_cleaning', 'dry cleaner': 'service.cleaning.dry_cleaning', 'dry cleaners': 'service.cleaning.dry_cleaning',
  bank: 'service.financial.bank', banks: 'service.financial.bank', atm: 'service.financial.atm', atms: 'service.financial.atm', restaurant: 'catering.restaurant', restaurants: 'catering.restaurant',
  pizza: 'catering.restaurant.pizza,catering.fast_food.pizza', cafe: 'catering.cafe', cafes: 'catering.cafe', 'coffee shop': 'catering.cafe',
  supermarket: 'commercial.supermarket', supermarkets: 'commercial.supermarket', fuel: 'service.vehicle.fuel', 'fuel station': 'service.vehicle.fuel',
  'petrol station': 'service.vehicle.fuel', 'gas station': 'service.vehicle.fuel',
  school: 'education.school', schools: 'education.school', university: 'education.university', universities: 'education.university', college: 'education.university', hotel: 'accommodation.hotel', hotels: 'accommodation.hotel', police: 'service.police', 'police station': 'service.police', 'police stations': 'service.police',
};

export function parseNearbyPlaceIntent(query: string): NearbyPlaceIntent | null {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const intent = normalized.endsWith(' near me') ? normalized.slice(0, -' near me'.length).trim() : normalized;
  const category = categories[intent];
  return category ? { category } : null;
}
