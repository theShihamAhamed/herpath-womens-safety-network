import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  status: 'IDLE' | 'ACTIVE' | 'COMPLETED';
  onStart: () => void;
  onCheckIn: () => void;
  onEnd: () => void;
  loading?: boolean;
}

export default function JourneyControls({ status, onStart, onCheckIn, onEnd, loading }: Props) {
  return (
    <View style={styles.row}>
      {status === 'IDLE' && (
        <Pressable style={[styles.btn, styles.primary]} onPress={onStart} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Start Journey</Text>}
        </Pressable>
      )}
      {status === 'ACTIVE' && (
        <>
          <Pressable style={[styles.btn, styles.outline]} onPress={onCheckIn} disabled={loading}>
            <Text style={styles.outlineText}>I&apos;m Safe</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.danger]} onPress={onEnd} disabled={loading}>
            <Text style={styles.btnText}>End Journey</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', padding: 16, gap: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#6C5CE7' },
  danger: { backgroundColor: '#D63031' },
  outline: { borderWidth: 1, borderColor: '#6C5CE7', backgroundColor: '#fff' },
  btnText: { color: '#fff', fontWeight: '600' },
  outlineText: { color: '#6C5CE7', fontWeight: '600' },
});