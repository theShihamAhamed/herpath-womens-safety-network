import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Callout, Marker } from 'react-native-maps';

import type { SupportPlace, SupportPlaceCategory } from './map.types';

interface SupportPlaceMarkerProps {
  place: SupportPlace;
  selected?: boolean;
  onSelect?: (place: SupportPlace) => void;
}

const categoryPresentation: Record<
  SupportPlaceCategory,
  { accessibilityLabel: string; icon: ComponentProps<typeof MaterialIcons>['name'] }
> = {
  POLICE: { accessibilityLabel: 'Police support place', icon: 'local-police' },
  MEDICAL: { accessibilityLabel: 'Medical support place', icon: 'local-hospital' },
  EMERGENCY: { accessibilityLabel: 'Emergency support place', icon: 'emergency' },
  WOMENS_SUPPORT: { accessibilityLabel: "Women's support place", icon: 'volunteer-activism' },
  COUNSELLING_SUPPORT: { accessibilityLabel: 'Counselling support place', icon: 'psychology' },
};

/** Presentation-only marker for real, normalized support-place search results. */
export function SupportPlaceMarker({ place, selected = false, onSelect }: SupportPlaceMarkerProps) {
  const presentation = categoryPresentation[place.category];
  const accessibilityLabel = `${presentation.accessibilityLabel}: ${place.name}`;

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
});
