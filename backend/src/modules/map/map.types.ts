export interface ViewportQuery {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
  category?: 'HARASSMENT' | 'THEFT' | 'ASSAULT' | 'STALKING' | 'OTHER';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dateFrom?: string;
  dateTo?: string;
  startHour?: number;
  endHour?: number;
}

export interface AreaSummaryQuery {
  lat: number;
  lng: number;
  radius: number;
}

export interface PublicIncidentProjection {
  id: string;
  category: string;
  severity: string;
  status: string;
  publicLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  createdAt: Date;
  supportCount: number;
}
