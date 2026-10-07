import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { palette } from '@/src/theme';

import type { DestinationSuggestion } from './types';

interface DestinationSearchResultMarkerProps {
  result: DestinationSuggestion;
  selected: boolean;
  onSelect: () => void;
}

/** A temporary map marker for a submitted destination search result. */
export function DestinationSearchResultMarker({ result, selected, onSelect }: DestinationSearchResultMarkerProps) {
  const icon = getDestinationResultIcon(result.category);

  return (
    <Marker
      coordinate={{ latitude: result.latitude, longitude: result.longitude }}
      title={result.name}
      description={result.address}
      accessibilityLabel={`${result.name}, search result`}
      onPress={onSelect}
      tracksViewChanges={false}>
      <View accessible accessibilityRole="image" accessibilityLabel={`${result.name}, search result`} style={[styles.marker, selected && styles.markerSelected]}>
        <MaterialIcons name={icon} size={20} color={palette.white} />
      </View>
    </Marker>
  );
}

function getDestinationResultIcon(category?: string): React.ComponentProps<typeof MaterialIcons>['name'] {
  const normalized = category?.toLowerCase() ?? '';
  if (normalized.includes('health')) return 'local-hospital';
  if (normalized.includes('catering') || normalized.includes('restaurant') || normalized.includes('food')) return 'restaurant';
  if (normalized.includes('financial')) return 'account-balance';
  if (normalized.includes('commercial') || normalized.includes('shopping')) return 'storefront';
  if (normalized.includes('education')) return 'school';
  if (normalized.includes('religion') || normalized.includes('worship')) return 'temple-hindu';
  if (normalized.includes('fuel') || normalized.includes('vehicle')) return 'local-gas-station';
  if (normalized.includes('accommodation')) return 'hotel';
  if (normalized.includes('sport') || normalized.includes('fitness')) return 'fitness-center';
  return 'place';
}

const styles = StyleSheet.create({
  marker: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: palette.white,
    backgroundColor: palette.primary,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  markerSelected: { backgroundColor: palette.accent, transform: [{ scale: 1.08 }] },
});
