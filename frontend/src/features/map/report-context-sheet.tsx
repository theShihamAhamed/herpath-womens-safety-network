import React, { useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { CATEGORY_CONFIG, SEVERITY_CONFIG, type PublicIncidentMarker } from './map.types';
import { summarizeVisibleIncidents } from './report-context-summary';

interface ReportContextSheetProps {
  incidents: PublicIncidentMarker[];
  onSelectIncident?: (incident: PublicIncidentMarker) => void;
}

/** A compact, map-owned summary of the public reports currently in view. */
export function ReportContextSheet({ incidents, onSelectIncident }: ReportContextSheetProps) {
  const count = incidents.length;
  const visibleSummary = summarizeVisibleIncidents(incidents);
  const summary = count === 1 ? '1 public report in this area' : `${count} public reports in this area`;
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded((current) => !current);
  const handleSelectIncident = (incident: PublicIncidentMarker) => {
    setExpanded(false);
    onSelectIncident?.(incident);
  };
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 8,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy < -20) setExpanded(true);
        if (gesture.dy > 20) setExpanded(false);
      },
    }),
    [],
  );

  return (
    <View style={[styles.sheet, expanded && styles.expanded]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} reports in this area`}
        accessibilityState={{ expanded }}
        onPress={toggleExpanded}
        style={styles.header}
        {...panResponder.panHandlers}>
        <View style={styles.handle} />
        <View style={styles.summaryRow}>
          <View style={styles.copy}>
            <Text style={styles.title}>Reports in this area</Text>
            <Text style={styles.summary}>{count === 0 ? 'No visible public reports' : summary}</Text>
            {visibleSummary.highSeverityCount > 0 ? (
              <Text style={styles.prioritySummary}>
                {visibleSummary.highSeverityCount} high-severity {visibleSummary.highSeverityCount === 1 ? 'report' : 'reports'}
              </Text>
            ) : null}
          </View>
          <Text style={styles.count}>{count}</Text>
        </View>
      </Pressable>
      {expanded && count > 0 ? (
        <ScrollView contentContainerStyle={styles.reportList} showsVerticalScrollIndicator={false}>
          <Text style={styles.contextNote}>
            Community-reported locations are shown as approximate areas, not exact locations.
          </Text>
          {incidents.map((incident) => {
            const category = CATEGORY_CONFIG[incident.category];
            const severity = SEVERITY_CONFIG[incident.severity];
            const occurredAt = new Date(incident.occurredAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Pressable
                key={incident.id}
                accessibilityRole="button"
                accessibilityLabel={`Focus approximate area for ${category.label}, ${severity.label} severity, occurred ${occurredAt}`}
                accessibilityHint="Centers the map on this report's approximate area"
                onPress={() => handleSelectIncident(incident)}
                style={styles.reportRow}>
                <Text style={styles.reportTitle}>{category.label}</Text>
                <Text style={[styles.reportSeverity, { color: severity.color }]}>{severity.label} severity</Text>
                <Text style={styles.reportDetail}>Occurred {occurredAt}</Text>
                {incident.supportCount > 0 ? (
                  <Text style={styles.reportDetail}>
                    {incident.supportCount} community {incident.supportCount === 1 ? 'support' : 'supports'}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {expanded && count === 0 ? (
        <View accessible accessibilityRole="summary" accessibilityLabel="No public reports are visible in this area" style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No public reports in this view</Text>
          <Text style={styles.emptyCopy}>
            This does not mean the area is safe. Move the map or adjust filters to explore available community data.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 112,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  expanded: { height: '58%' },
  header: { minHeight: 88 },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  title: { color: palette.text, fontSize: 17, fontWeight: '800' },
  summary: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  prioritySummary: { color: palette.text, fontSize: 12, fontWeight: '700' },
  count: { color: palette.primary, fontSize: 24, fontWeight: '800' },
  reportList: { gap: spacing.sm, paddingBottom: spacing.sm },
  contextNote: { color: palette.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.xs },
  reportRow: {
    gap: 3,
    minHeight: 72,
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.background,
  },
  reportTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  reportSeverity: { fontSize: 13, fontWeight: '700' },
  reportDetail: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  emptyState: { gap: spacing.sm, paddingVertical: spacing.md },
  emptyTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
});
