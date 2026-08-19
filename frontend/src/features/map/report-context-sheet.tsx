import React, { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import type { PublicIncidentMarker } from './map.types';

interface ReportContextSheetProps {
  incidents: PublicIncidentMarker[];
}

/** A compact, map-owned summary of the public reports currently in view. */
export function ReportContextSheet({ incidents }: ReportContextSheetProps) {
  const count = incidents.length;
  const summary = count === 1 ? '1 public report in this area' : `${count} public reports in this area`;
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded((current) => !current);
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
          </View>
          <Text style={styles.count}>{count}</Text>
        </View>
      </Pressable>
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
  count: { color: palette.primary, fontSize: 24, fontWeight: '800' },
});
