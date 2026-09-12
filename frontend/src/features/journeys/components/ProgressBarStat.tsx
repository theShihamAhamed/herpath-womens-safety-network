// ProgressBarStat.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '@/src/theme';

export default function ProgressBarStat({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percent}>{percentage}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 13, color: palette.text, fontWeight: '600' },
  percent: { fontSize: 13, color: palette.textMuted, fontWeight: '600' },
  track: { height: 8, backgroundColor: palette.surfaceMuted, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.sm },
});