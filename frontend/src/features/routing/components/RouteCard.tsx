// frontend/src/features/routing/components/RouteCard.tsx

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteWithRiskContext } from '../types/routing.types';

interface RouteCardProps {
  route: RouteWithRiskContext;
  isRecommended: boolean;
  selected: boolean;
  onPress: () => void;
}

function getIndicatorLevel(count: number): { label: string; color: string } {
  if (count === 0) return { label: 'No recent reports', color: '#2F8F6E' };
  if (count <= 3) return { label: 'Few recent reports', color: '#C98A2C' };
  return { label: 'Multiple recent reports', color: '#C1512E' };
}

export function RouteCard({
  route,
  isRecommended,
  selected,
  onPress,
}: RouteCardProps) {
  const indicator = getIndicatorLevel(route.nearbyIncidentCount);

  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.headerRow}>
        <Text style={styles.summaryLabel} numberOfLines={1}>
          {route.summaryLabel}
        </Text>
        {isRecommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedBadgeText}>Recommended</Text>
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{route.durationText}</Text>
        <Text style={styles.metaDivider}>·</Text>
        <Text style={styles.metaText}>{route.distanceText}</Text>
      </View>

      <View style={styles.indicatorRow}>
        <View style={[styles.dot, { backgroundColor: indicator.color }]} />
        <Text style={[styles.indicatorText, { color: indicator.color }]}>
          {indicator.label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E4E7EB',
  },
  cardSelected: {
    borderColor: '#1F4B4A',
    borderWidth: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  recommendedBadge: {
    backgroundColor: '#E4F1EC',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  recommendedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F4B4A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#4B5563',
  },
  metaDivider: {
    marginHorizontal: 6,
    color: '#9CA3AF',
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  indicatorText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
