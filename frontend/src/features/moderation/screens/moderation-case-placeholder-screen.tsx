import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/screen';
import { palette, radius, spacing } from '@/src/theme';

export function ModerationCasePlaceholderScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.card}>
        <MaterialIcons name="fact-check" size={36} color={palette.primary} />
        <Text accessibilityRole="header" style={styles.title}>
          Case review
        </Text>
        <Text style={styles.text}>
          Case details and moderation actions are not available in this dashboard phase.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  card: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
  },
  title: { color: palette.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  text: { color: palette.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
