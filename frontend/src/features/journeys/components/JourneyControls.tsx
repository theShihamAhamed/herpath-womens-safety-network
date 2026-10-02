import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { palette, radius, spacing } from '@/src/theme';

interface Props {
  status: 'IDLE' | 'ACTIVE' | 'COMPLETED';
  onStart: () => void;
  onCheckIn: () => void;
  onEnd: () => void;
  onCancel?: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function JourneyControls({ status, onStart, onCheckIn, onEnd, onCancel, loading, error }: Props) {
  return (
    <>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry ending journey" onPress={onEnd}>
            <Text style={styles.retryLink}>Retry</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        {status === 'IDLE' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start journey"
            accessibilityState={{ disabled: loading }}
            style={[styles.btn, styles.primary]}
            onPress={onStart}
            disabled={loading}>
            {loading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.btnText}>Start Journey</Text>}
          </Pressable>
        )}

        {status === 'ACTIVE' && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check in, I'm safe"
              accessibilityState={{ disabled: loading }}
              style={[styles.btn, styles.outline]}
              onPress={onCheckIn}
              disabled={loading}>
              <Text style={styles.outlineText}>I&apos;m Safe</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End journey"
              accessibilityState={{ disabled: loading }}
              style={[styles.btn, styles.danger]}
              onPress={onEnd}
              disabled={loading}>
              <Text style={styles.btnText}>End Journey</Text>
            </Pressable>
          </>
        )}
      </View>

      {status === 'ACTIVE' && onCancel && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel journey"
          accessibilityState={{ disabled: loading }}
          style={styles.cancelLink}
          onPress={onCancel}
          disabled={loading}>
          <Text style={styles.cancelText}>Cancel journey</Text>
        </Pressable>
      )}
    </>
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
  errorBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm, backgroundColor: palette.error + '1A', marginHorizontal: spacing.md },
  errorText: { color: palette.error, fontSize: 13, flex: 1 },
  retryLink: { color: palette.primary, fontWeight: '700', marginLeft: spacing.sm },
  cancelLink: { alignItems: 'center', paddingBottom: spacing.md, backgroundColor: palette.surface },
  cancelText: { color: palette.textMuted, fontWeight: '600', fontSize: 13 },
});