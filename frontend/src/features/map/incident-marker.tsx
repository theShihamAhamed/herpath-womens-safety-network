import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { IncidentCallout } from './incident-callout';
import type { PublicIncidentMarker } from './map.types';
import { CATEGORY_CONFIG } from './map.types';

interface IncidentMarkerProps {
  incident: PublicIncidentMarker;
  onSelect?: (incident: PublicIncidentMarker) => void;
}

export function IncidentMarker({ incident, onSelect }: IncidentMarkerProps) {
  const [longitude, latitude] = incident.publicLocation.coordinates;
  const config = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.OTHER;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={() => onSelect?.(incident)}
      tracksViewChanges={false}
    >
      <View style={[styles.markerPin, { backgroundColor: config.color }]}>
        <View style={styles.innerDot} />
      </View>
      <IncidentCallout incident={incident} />
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
