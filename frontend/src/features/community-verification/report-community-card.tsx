import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CATEGORY_CONFIG,
  SEVERITY_CONFIG,
  type PublicIncidentMarker,
} from '@/src/features/map/map.types';
import { palette, radius, spacing } from '@/src/theme';

import type { CommunityIncidentChange } from './community-verification.types';
import { ReportCommunityPanel } from './report-community-panel';

interface ReportCommunityCardProps {
  incident: PublicIncidentMarker;
  expanded: boolean;
  onToggle: () => void;
  onShowOnMap: () => void;
  onIncidentChanged?: (change: CommunityIncidentChange) => void;
}

export function ReportCommunityCard({
  incident,
  expanded,
  onToggle,
  onShowOnMap,
  onIncidentChanged,
}: ReportCommunityCardProps) {
  const category = CATEGORY_CONFIG[incident.category];
  const severity = SEVERITY_CONFIG[incident.severity];
  const occurredAt = new Date(incident.occurredAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityHint={expanded ? 'Collapses community actions' : 'Expands community actions without moving the map'}
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} community actions for ${category.label} report`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.summaryButton}>
        <View style={styles.summaryCopy}>
          <Text style={styles.title}>{category.label}</Text>
          <Text style={[styles.severity, { color: severity.color }]}>{severity.label} severity</Text>
          <Text style={styles.detail}>Occurred {occurredAt}</Text>
          {incident.supportCount > 0 ? (
            <Text style={styles.detail}>
              {incident.supportCount} community {incident.supportCount === 1 ? 'support' : 'supports'}
            </Text>
          ) : null}
        </View>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.expandText}>
          {expanded ? 'Collapse' : 'Community actions'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityLabel={`Show ${category.label} report on map`}
        accessibilityRole="button"
        onPress={onShowOnMap}
        style={styles.mapButton}>
        <Text style={styles.mapButtonText}>Show on map</Text>
      </Pressable>

      {expanded ? (
        <ReportCommunityPanel incidentId={incident.id} onIncidentChanged={onIncidentChanged} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    minHeight: 72,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.background,
  },
  summaryButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryCopy: { flex: 1, gap: 3 },
  title: { color: palette.text, fontSize: 15, fontWeight: '800' },
  severity: { fontSize: 13, fontWeight: '700' },
  detail: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  expandText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  mapButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
  },
  mapButtonText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
});
