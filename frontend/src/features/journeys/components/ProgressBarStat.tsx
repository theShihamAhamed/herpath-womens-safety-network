import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProgressBarStat({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text>{label}</Text>
        <Text>{percentage}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  track: { height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8 },
});