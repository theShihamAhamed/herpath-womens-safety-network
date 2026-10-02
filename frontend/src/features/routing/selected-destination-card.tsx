import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { Destination, RouteOrigin } from './types';

interface SelectedDestinationCardProps {
  destination: Destination | null;
  origin?: RouteOrigin | null;
  onChangeDestination?: () => void;
  onChangeOrigin?: () => void;
  onClearDestination?: () => void;
  onPlanRoute?: () => void;
}

export function SelectedDestinationCard({
  destination,
  origin,
  onChangeDestination,
  onChangeOrigin,
  onClearDestination,
  onPlanRoute,
}: SelectedDestinationCardProps) {
  if (!destination) {
    return null;
  }

  const originDisplay = origin
    ? origin.name || origin.address || 'Starting Location'
    : 'No starting point selected';
  const isManualOrigin = Boolean(origin?.isManual);

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Selected trip: From ${originDisplay} to ${destination.name}`}
      style={styles.card}>
      {/* Origin Row */}
      <View style={styles.endpointRow}>
        <View style={styles.originIconBadge}>
          <MaterialIcons name="trip-origin" size={20} color={palette.primary} />
        </View>
        <View style={styles.info}>
          <View style={styles.labelWithTag}>
            <Text style={styles.headerLabel}>Starting Point</Text>
            {origin ? (
              <View style={[styles.originTag, isManualOrigin ? styles.manualTag : styles.gpsTag]}>
                <Text style={[styles.originTagText, isManualOrigin ? styles.manualTagText : styles.gpsTagText]}>
                  {isManualOrigin ? 'Custom' : 'GPS'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {originDisplay}
          </Text>
          {origin?.address && origin.name !== origin.address ? (
            <Text style={styles.address} numberOfLines={1}>
              {origin.address}
            </Text>
          ) : origin ? (
            <Text style={styles.subtext}>
              {origin.latitude.toFixed(4)}, {origin.longitude.toFixed(4)}
            </Text>
          ) : (
            <Text style={styles.warningSubtext}>Tap change to select a starting point</Text>
          )}
        </View>
        {onChangeOrigin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change starting location"
            hitSlop={8}
            onPress={onChangeOrigin}
            style={({ pressed }) => [styles.smallEditButton, pressed && styles.pressed]}>
            <MaterialIcons name="edit" size={16} color={palette.primary} />
            <Text style={styles.smallEditText}>Change</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.routeDivider}>
        <View style={styles.routeDividerDot} />
        <View style={styles.routeDividerLine} />
        <View style={styles.routeDividerDot} />
      </View>

      {/* Destination Row */}
      <View style={styles.endpointRow}>
        <View style={styles.destIconBadge}>
          <MaterialIcons name="place" size={22} color={palette.accent} />
        </View>
        <View style={styles.info}>
          <Text style={styles.headerLabel}>Destination</Text>
          <Text style={styles.name} numberOfLines={1}>
            {destination.name}
          </Text>
          <Text style={styles.address} numberOfLines={1}>
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

      {/* Actions Row */}
      <View style={styles.actionsRow}>
        {onChangeDestination ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change destination"
            onPress={onChangeDestination}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <MaterialIcons name="search" size={18} color={palette.text} />
            <Text style={styles.secondaryButtonText}>Change Destination</Text>
          </Pressable>
        ) : null}

        {onPlanRoute ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find safe routes for this trip"
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
    gap: spacing.xs,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  originIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F3F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  destIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDEEE9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  labelWithTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  originTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gpsTag: {
    backgroundColor: '#E8F3F1',
  },
  manualTag: {
    backgroundColor: '#EBF2FA',
  },
  originTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  gpsTagText: {
    color: palette.primary,
  },
  manualTagText: {
    color: '#2A6496',
  },
  name: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  address: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  subtext: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  warningSubtext: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  routeDivider: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 17,
    marginVertical: 1,
    height: 12,
    justifyContent: 'space-between',
  },
  routeDividerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.border,
  },
  routeDividerLine: {
    width: 1,
    height: 4,
    backgroundColor: palette.border,
  },
  smallEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F3F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'center',
  },
  smallEditText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  clearButton: {
    padding: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 40,
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 13,
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