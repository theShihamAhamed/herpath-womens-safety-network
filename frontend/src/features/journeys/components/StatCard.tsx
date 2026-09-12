// StatCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '@/src/theme';

export default function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color: color ?? palette.text }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    backgroundColor: palette.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: palette.border,
  },
  value: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 12, color: palette.textMuted, marginTop: 4, fontWeight: '600' },
});