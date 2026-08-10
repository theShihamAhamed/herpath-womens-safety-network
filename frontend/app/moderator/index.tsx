import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/screen';
import { palette, radius, spacing } from '@/src/theme';

export default function ModeratorPlaceholderScreen() {
  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>MODERATOR ACCESS</Text>
        <Text style={styles.title}>Moderation</Text>
        <View style={styles.card}>
          <Text style={styles.text}>The moderation queue will be implemented in its own feature.</Text>
          <Text style={styles.note}>
            This route guard controls navigation only. Backend role authorization remains the security boundary.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, marginTop: spacing.md },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: palette.text, fontSize: 32, fontWeight: '800' },
  card: {
    marginTop: spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  text: { color: palette.text, fontSize: 17, lineHeight: 25 },
  note: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
});
