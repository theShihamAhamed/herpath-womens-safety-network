import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { JourneyHistoryItem } from '../types';
import { palette, radius, spacing } from '@/src/theme';

const outcomeMeta: Record<string, { color: string; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  SAFE_CONFIRMED: { color: palette.primary, label: 'Safe', icon: 'check-circle' },
  INCIDENT_REPORTED: { color: palette.error, label: 'Incident', icon: 'report-problem' },
  UNKNOWN: { color: palette.textMuted, label: 'Unknown', icon: 'help-outline' },
};

export default function JourneyHistoryCard({ item, onPress }: { item: JourneyHistoryItem; onPress: () => void }) {
  const meta = outcomeMeta[item.outcome ?? 'UNKNOWN'];
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.rowTop}>
        <MaterialIcons name="place" size={18} color={palette.primary} />
        <Text style={styles.destination}>{item.destination.address ?? 'Destination'}</Text>
      </View>
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.meta}>{Math.round(item.distanceTravelled)} m</Text>
        <Text style={styles.meta}>{Math.round(item.duration / 60)} min</Text>
        <View style={[styles.badge, { backgroundColor: meta.color + '1A' }]}>
          <MaterialIcons name={meta.icon} size={14} color={meta.color} />
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: palette.border,
  },
  pressed: { opacity: 0.85 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  destination: { fontSize: 16, fontWeight: '700', color: palette.text },
  meta: { fontSize: 12, color: palette.textMuted },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { fontSize: 11, fontWeight: '700' },
});