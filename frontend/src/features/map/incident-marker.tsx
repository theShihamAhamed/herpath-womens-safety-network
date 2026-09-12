import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { IncidentCallout } from './incident-callout';
import type { PublicIncidentMarker } from './map.types';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from './map.types';

interface IncidentMarkerProps {
  incident: PublicIncidentMarker;
  onSelect?: (incident: PublicIncidentMarker) => void;
}

export function IncidentMarker({ incident, onSelect }: IncidentMarkerProps) {
  const [longitude, latitude] = incident.publicLocation.coordinates;
  const config = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.OTHER;
  const severity = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.LOW;
  const occurredAt = new Date(incident.occurredAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const accessibilityLabel = `Approximate area center for ${config.label}. ${severity.label} severity. Community report. Occurred ${occurredAt}.`;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={() => onSelect?.(incident)}
      tracksViewChanges={false}
    >
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={[styles.markerPin, { borderColor: config.color }]}
      >
        <View style={[styles.innerDot, { backgroundColor: config.color }]} />
      </View>
      <IncidentCallout incident={incident} />
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
