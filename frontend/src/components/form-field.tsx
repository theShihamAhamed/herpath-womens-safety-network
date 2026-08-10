import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

export function FormField({ label, ...inputProps }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={palette.textMuted}
        style={[styles.input, inputProps.style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { color: palette.text, fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: palette.text,
    backgroundColor: palette.surface,
    fontSize: 16,
  },
});
