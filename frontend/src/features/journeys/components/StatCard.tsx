import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, color ? { color } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 12, elevation: 2 },
  value: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 12, color: '#666', marginTop: 4 },
});