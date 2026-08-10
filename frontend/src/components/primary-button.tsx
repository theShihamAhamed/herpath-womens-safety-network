import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondary,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.white : palette.primary} />
      ) : (
        <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
  },
  secondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.primary },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  label: { color: palette.white, fontSize: 16, fontWeight: '700' },
  secondaryLabel: { color: palette.primary },
});
