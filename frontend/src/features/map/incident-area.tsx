import React from 'react';
import { Polygon, type LatLng } from 'react-native-maps';

import type { PublicIncidentMarker } from './map.types';

interface IncidentAreaProps {
  incident: PublicIncidentMarker;
}

/** Converts the public GeoJSON ring supplied by the API into map coordinates. */
export function toMapAreaCoordinates(incident: PublicIncidentMarker): LatLng[] {
  const outerRing = incident.publicArea.coordinates[0] ?? [];
  return outerRing.map(([longitude, latitude]) => ({ latitude, longitude }));
}

/**
 * Renders the privacy-safe area returned by the backend. This is deliberately
 * an approximate area, not an exact incident boundary.
 */
export function IncidentArea({ incident }: IncidentAreaProps) {
  return (
    <Polygon
      coordinates={toMapAreaCoordinates(incident)}
      fillColor="rgba(23, 107, 91, 0.14)"
      strokeColor="rgba(23, 107, 91, 0.72)"
      strokeWidth={1.5}
      tappable={false}
    />
  );
}
