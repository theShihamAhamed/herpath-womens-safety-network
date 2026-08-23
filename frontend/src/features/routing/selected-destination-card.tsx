import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { Destination } from './types';

interface SelectedDestinationCardProps {
  destination: Destination | null;
  onChangeDestination?: () => void;
  onClearDestination?: () => void;
  onPlanRoute?: () => void;
}

export function SelectedDestinationCard({
  destination,
  onChangeDestination,
  onClearDestination,
  onPlanRoute,
}: SelectedDestinationCardProps) {
  if (!destination) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Selected destination: ${destination.name}`}
      style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconBadge}>
          <MaterialIcons name="place" size={24} color={palette.accent} />
        </View>
        <View style={styles.info}>
          <Text style={styles.headerLabel}>Destination Selected</Text>
          <Text style={styles.name} numberOfLines={1}>
            {destination.name}
          </Text>
          <Text style={styles.address} numberOfLines={2}>
            {destination.address}
          </Text>
        </View>
        {onClearDestination ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove selected destination"
            hitSlop={8}
            onPress={onClearDestination}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <MaterialIcons name="close" size={20} color={palette.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.coordinatesBadge}>
        <MaterialIcons name="my-location" size={14} color={palette.primary} />
        <Text style={styles.coordinatesText}>
          {destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}
        </Text>
      </View>

      <View style={styles.actionsRow}>
        {onChangeDestination ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change destination"
            onPress={onChangeDestination}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <MaterialIcons name="edit" size={18} color={palette.text} />
            <Text style={styles.secondaryButtonText}>Change</Text>
          </Pressable>
        ) : null}

        {onPlanRoute ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find safe routes to this destination"
            onPress={onPlanRoute}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
            <MaterialIcons name="directions" size={18} color={palette.white} />
            <Text style={styles.primaryButtonText}>Find Safe Routes</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: spacing.sm,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDEEE9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  headerLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  address: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  clearButton: {
    padding: spacing.xs,
  },
  coordinatesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  coordinatesText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 40,
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: palette.primary,
    minHeight: 40,
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  primaryPressed: {
    backgroundColor: palette.primaryPressed,
  },
});