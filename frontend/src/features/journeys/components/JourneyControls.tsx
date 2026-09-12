import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { palette, radius, spacing } from '@/src/theme';

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
          {loading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.btnText}>Start Journey</Text>}
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
  row: { flexDirection: 'row', justifyContent: 'space-around', padding: spacing.md, gap: spacing.sm, backgroundColor: palette.surface },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: palette.primary },
  danger: { backgroundColor: palette.error },
  outline: { borderWidth: 1.5, borderColor: palette.primary, backgroundColor: palette.surface },
  btnText: { color: palette.white, fontWeight: '700', fontSize: 15 },
  outlineText: { color: palette.primary, fontWeight: '700', fontSize: 15 },
});