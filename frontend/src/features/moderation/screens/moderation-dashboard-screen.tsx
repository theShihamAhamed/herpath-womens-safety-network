import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/screen';
import { palette, radius, spacing } from '@/src/theme';

export function ModerationDashboardScreen() {
  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MODERATOR ACCESS</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Moderation
        </Text>
        <Text style={styles.subtitle}>
          Review community reports through a privacy-conscious, audited workflow.
        </Text>
      </View>

      <View accessible accessibilityLabel="Moderator access active" style={styles.accessCard}>
        <View style={styles.accessIcon}>
          <MaterialIcons name="verified-user" size={24} color={palette.primary} />
        </View>
        <View style={styles.accessCopy}>
          <Text style={styles.accessTitle}>Moderator access active</Text>
          <Text style={styles.accessText}>
            Every moderation request is also protected by backend role authorization.
          </Text>
        </View>
      </View>

      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <MaterialIcons name="inbox" size={32} color={palette.primary} />
        </View>
        <Text style={styles.emptyTitle}>No moderation cases loaded</Text>
        <Text style={styles.emptyText}>
          The case queue and review tools will appear here when case loading is enabled.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingVertical: spacing.xl },
  header: { gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: palette.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: palette.textMuted, fontSize: 16, lineHeight: 24, maxWidth: 520 },
  accessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  accessIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: palette.surface,
  },
  accessCopy: { flex: 1, gap: spacing.xs },
  accessTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  accessText: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  emptyState: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: palette.surfaceMuted,
  },
  emptyTitle: { color: palette.text, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  emptyText: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
});
