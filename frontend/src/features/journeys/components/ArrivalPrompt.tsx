import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '@/src/theme';

interface Props {
  onConfirm: () => void;
  onContinue: () => void;
}

export default function ArrivalPrompt({ onConfirm, onContinue }: Props) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.title}>Have you arrived?</Text>
        <Text style={styles.body}>You appear to be near your destination.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm arrival and finish journey"
          style={[styles.btn, styles.primary]}
          onPress={onConfirm}>
          <Text style={styles.primaryText}>Yes, I&apos;ve arrived</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not yet, keep tracking journey"
          style={styles.secondary}
          onPress={onContinue}>
          <Text style={styles.secondaryText}>Not yet, keep tracking</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '85%',
  },
  title: { fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 4, textAlign: 'center' },
  body: { fontSize: 13, color: palette.textMuted, marginBottom: spacing.md, textAlign: 'center' },
  btn: { paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.sm },
  primary: { backgroundColor: palette.primary },
  primaryText: { color: palette.white, fontWeight: '700' },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: palette.textMuted, fontWeight: '600' },
});