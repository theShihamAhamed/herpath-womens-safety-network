import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/src/theme';

export function SafetyUpdatesScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <View style={styles.iconSurface}>
            <MaterialIcons name="notifications-none" size={32} color={palette.primary} />
          </View>
          <Text style={styles.title}>No new safety updates.</Text>
          <Text style={styles.description}>
            Nearby report, route, journey, and account updates will appear here when available.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  emptyState: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  iconSurface: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: palette.surfaceMuted,
  },
  title: { color: palette.text, fontSize: 21, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  description: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
