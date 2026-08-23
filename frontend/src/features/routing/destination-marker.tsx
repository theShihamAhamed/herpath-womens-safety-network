import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Callout, Marker } from 'react-native-maps';

import { palette, radius, spacing } from '@/src/theme';

import { Destination } from './types';

interface DestinationMarkerProps {
  destination: Destination | null;
}

export function DestinationMarker({ destination }: DestinationMarkerProps) {
  if (!destination) {
    return null;
  }

  return (
    <Marker
      coordinate={{
        latitude: destination.latitude,
        longitude: destination.longitude,
      }}
      title={destination.name}
      description={destination.address}
      tracksViewChanges={false}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Destination pin for ${destination.name}`}
        style={styles.markerContainer}>
        <View style={styles.pinBubble}>
          <MaterialIcons name="flag" size={18} color={palette.white} />
        </View>
        <View style={styles.pinTip} />
      </View>

      <Callout tooltip>
        <View style={styles.calloutContainer}>
          <Text style={styles.calloutTitle}>{destination.name}</Text>
          <Text style={styles.calloutAddress} numberOfLines={2}>
            {destination.address}
          </Text>
          <Text style={styles.calloutHint}>Target Destination</Text>
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
  },
  pinBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.white,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: palette.accent,
    alignSelf: 'center',
    marginTop: -1,
  },
  calloutContainer: {
    backgroundColor: palette.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    minWidth: 180,
    maxWidth: 260,
    gap: 2,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  calloutTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  calloutAddress: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  calloutHint: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
