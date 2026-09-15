import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Callout, Marker } from 'react-native-maps';

import type { SupportPlace } from './map.types';
import { formatSupportPlaceDistance } from './support-place-distance';
import { supportPlacePresentation } from './support-place-presentation';

interface SupportPlaceMarkerProps {
  place: SupportPlace;
  distanceMetres?: number | null;
  selected?: boolean;
  onSelect?: (place: SupportPlace) => void;
}

/** Presentation-only marker for real, normalized support-place search results. */
export function SupportPlaceMarker({
  place,
  distanceMetres = null,
  selected = false,
  onSelect,
}: SupportPlaceMarkerProps) {
  const presentation = supportPlacePresentation[place.category];
  const distanceText = formatSupportPlaceDistance(distanceMetres);
  const accessibilityLabel = [place.name, presentation.label, distanceText ? `approximately ${distanceText}` : null]
    .filter(Boolean)
    .join(', ');

  return (
    <Marker
      coordinate={place.location}
      onPress={() => onSelect?.(place)}
      tracksViewChanges={false}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        style={[styles.marker, selected && styles.markerSelected]}>
        <MaterialIcons name={presentation.icon} size={20} color="#FFFFFF" />
      </View>
      <Callout tooltip>
        <View style={styles.callout}>
          <Text style={styles.calloutName}>{place.name}</Text>
          <Text style={styles.calloutCategory}>{presentation.label}</Text>
          {distanceText ? <Text style={styles.calloutDistance}>Approx. {distanceText}</Text> : null}
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#176B5B',
    elevation: 4,
    shadowColor: '#18201E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  markerSelected: {
    borderColor: '#D2645A',
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  callout: {
    minWidth: 140,
    maxWidth: 240,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D7DEDC',
    backgroundColor: '#FFFFFF',
  },
  calloutName: { color: '#18201E', fontSize: 14, fontWeight: '700' },
  calloutCategory: { color: '#5F6C68', fontSize: 12, marginTop: 4 },
  calloutDistance: { color: '#176B5B', fontSize: 12, fontWeight: '600', marginTop: 2 },
});
