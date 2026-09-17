import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { CATEGORY_CONFIG, SEVERITY_CONFIG, type PublicIncidentMarker } from './map.types';
import { clampReportSheetOffset, resolveReportSheetSnapOffset } from './report-sheet-motion';
import { summarizeVisibleIncidents } from './report-context-summary';

const COLLAPSED_SHEET_HEIGHT = 64;
const LARGE_TEXT_COLLAPSED_SHEET_HEIGHT = 88;
const SHEET_HEIGHT_RATIO = 0.58;
const SETTLE_ANIMATION = { duration: 220, easing: Easing.out(Easing.cubic) };

interface ReportContextSheetProps {
  incidents: PublicIncidentMarker[];
  onSelectIncident?: (incident: PublicIncidentMarker) => void;
  onExpandedChange?: (expanded: boolean) => void;
  safetyInformationUnavailable?: boolean;
  onRetrySafetyInformation?: () => void;
}

/** A compact, map-owned summary of the public reports currently in view. */
export function ReportContextSheet({
  incidents,
  onSelectIncident,
  onExpandedChange,
  safetyInformationUnavailable = false,
  onRetrySafetyInformation,
}: ReportContextSheetProps) {
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const count = incidents.length;
  const visibleSummary = summarizeVisibleIncidents(incidents);
  const summary = count === 1 ? '1 public report in this area' : `${count} public reports in this area`;
  const collapsedSheetHeight = fontScale >= 1.35 ? LARGE_TEXT_COLLAPSED_SHEET_HEIGHT : COLLAPSED_SHEET_HEIGHT;
  const sheetHeight = Math.round(windowHeight * SHEET_HEIGHT_RATIO);
  const collapsedOffset = Math.max(sheetHeight - collapsedSheetHeight, 0);
  const [expanded, setExpanded] = useState(false);
  const sheetOffset = useSharedValue(collapsedOffset);
  const dragStartOffset = useSharedValue(collapsedOffset);
  const updateExpanded = useCallback((nextExpanded: boolean) => {
    setExpanded(nextExpanded);
    onExpandedChange?.(nextExpanded);
  }, [onExpandedChange]);
  useEffect(() => {
    const offset = expanded ? 0 : collapsedOffset;
    sheetOffset.value = offset;
    dragStartOffset.value = offset;
  }, [collapsedOffset, dragStartOffset, expanded, sheetOffset]);
  const settleSheet = useCallback((nextExpanded: boolean) => {
    sheetOffset.value = withTiming(nextExpanded ? 0 : collapsedOffset, SETTLE_ANIMATION);
    updateExpanded(nextExpanded);
  }, [collapsedOffset, sheetOffset, updateExpanded]);
  const toggleExpanded = () => settleSheet(!expanded);
  const handleSelectIncident = (incident: PublicIncidentMarker) => {
    settleSheet(false);
    onSelectIncident?.(incident);
  };
  const handleGestureEnd = useCallback((offset: number, velocityY: number) => {
    const snapOffset = resolveReportSheetSnapOffset(offset, velocityY, collapsedOffset);
    settleSheet(snapOffset === 0);
  }, [collapsedOffset, settleSheet]);
  const panGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY([-8, 8])
      .failOffsetX([-32, 32])
      .onBegin(() => {
        dragStartOffset.value = sheetOffset.value;
      })
      .onUpdate((event) => {
        sheetOffset.value = clampReportSheetOffset(dragStartOffset.value + event.translationY, collapsedOffset);
      })
      .onEnd((event) => runOnJS(handleGestureEnd)(sheetOffset.value, event.velocityY)),
    [collapsedOffset, dragStartOffset, handleGestureEnd, sheetOffset],
  );
  const animatedSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetOffset.value }] }));

  return (
    <Animated.View style={[styles.sheet, { height: sheetHeight }, animatedSheetStyle]}>
      <GestureDetector gesture={panGesture}>
        <View collapsable={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} reports in this area`}
            accessibilityHint={expanded ? 'Collapses the report list to show more of the map' : 'Expands the visible report list'}
            accessibilityState={{ expanded }}
            accessibilityActions={[
              { name: expanded ? 'collapse' : 'expand', label: expanded ? 'Collapse report list' : 'Expand report list' },
            ]}
            onAccessibilityAction={(event) => settleSheet(event.nativeEvent.actionName === 'expand')}
            onPress={toggleExpanded}
            style={[styles.header, { minHeight: collapsedSheetHeight - 6 }]}>
            <View style={styles.handle} />
            <View style={styles.summaryRow}>
              <Text maxFontSizeMultiplier={1.6} style={styles.title}>Reports in this area</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.count}>{count}</Text>
            </View>
          </Pressable>
        </View>
      </GestureDetector>
      <ScrollView style={styles.reportListContainer} contentContainerStyle={styles.reportList} showsVerticalScrollIndicator={false}>
        {safetyInformationUnavailable ? (
          <View accessible accessibilityRole="alert" style={styles.safetyUnavailable}>
            <Text style={styles.sectionTitle}>Safety information</Text>
            <Text style={styles.safetyUnavailableTitle}>Safety information is unavailable</Text>
            <Text style={styles.safetyUnavailableCopy}>
              Check your connection and try moving the map again. Safety information may be limited while the service is unavailable.
            </Text>
            {onRetrySafetyInformation ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry safety information"
                onPress={onRetrySafetyInformation}
                style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.expandedSummary}>
          <Text style={styles.summary}>{count === 0 ? 'No visible public reports' : summary}</Text>
          {visibleSummary.highSeverityCount > 0 ? (
            <Text style={styles.prioritySummary}>
              {visibleSummary.highSeverityCount} high-severity {visibleSummary.highSeverityCount === 1 ? 'report' : 'reports'}
            </Text>
          ) : null}
        </View>
        {count > 0 ? (
          <>
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
          </>
        ) : (
          <View accessible accessibilityRole="summary" accessibilityLabel="No public reports are visible in this area" style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No reports are visible in this area</Text>
            <Text style={styles.emptyCopy}>
              This does not mean the area is safe. Adjust your filters or move the map to explore available community data.
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  header: { paddingBottom: 4 },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: 6 },
  title: { flex: 1, flexShrink: 1, color: palette.text, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  summary: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  prioritySummary: { color: palette.text, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  safetyUnavailable: {
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.background,
  },
  safetyUnavailableTitle: { color: palette.text, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  safetyUnavailableCopy: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.primary },
  retryText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  count: { flexShrink: 0, color: palette.primary, fontSize: 24, fontWeight: '800' },
  expandedSummary: { gap: spacing.xs, marginBottom: spacing.md },
  reportListContainer: { flex: 1 },
  reportList: { gap: spacing.sm, paddingBottom: spacing.sm, flexGrow: 1 },
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
