import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { Screen } from './screen';

export function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>HERPATH</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Safety context based on available community information.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardText}>{description}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: palette.text, fontSize: 32, lineHeight: 38, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardText: { color: palette.text, fontSize: 17, lineHeight: 25 },
});
