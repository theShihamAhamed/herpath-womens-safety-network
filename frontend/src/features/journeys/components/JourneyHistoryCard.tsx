import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { JourneyHistoryItem } from '../types';

const outcomeColor: Record<string, string> = { SAFE_CONFIRMED: '#00B894', INCIDENT_REPORTED: '#D63031', UNKNOWN: '#B2BEC3' };
const outcomeLabel: Record<string, string> = { SAFE_CONFIRMED: 'Safe', INCIDENT_REPORTED: 'Incident', UNKNOWN: 'Unknown' };

export default function JourneyHistoryCard({ item, onPress }: { item: JourneyHistoryItem; onPress: () => void }) {
  const outcome = item.outcome ?? 'UNKNOWN';
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.destination}>{item.destination.address ?? 'Destination'}</Text>
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{Math.round(item.distanceTravelled)} m</Text>
        <Text style={styles.meta}>{Math.round(item.duration / 60)} min</Text>
        <Text style={[styles.badge, { backgroundColor: outcomeColor[outcome] }]}>{outcomeLabel[outcome]}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  destination: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, color: '#666' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' },
  badge: { color: '#fff', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
});