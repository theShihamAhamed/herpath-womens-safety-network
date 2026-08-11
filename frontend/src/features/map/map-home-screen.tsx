import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/screen';
import { RoutePlanningEntry, RouteResultsPlaceholder } from '@/src/features/routing';
import { palette, radius, spacing } from '@/src/theme';

export function MapHomeScreen() {
  const router = useRouter();

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>COMMUNITY SAFETY</Text>
          <Text style={styles.title}>HerPath</Text>
        </View>
        <Pressable
          accessibilityLabel="Open safety updates"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.push('/alerts')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <MaterialIcons name="notifications-none" size={26} color={palette.text} />
        </Pressable>
      </View>

      <RoutePlanningEntry />

      <View style={styles.mapSurface}>
        <View style={styles.mapIcon}>
          <MaterialIcons name="map" size={34} color={palette.primary} />
        </View>
        <Text style={styles.mapTitle}>Map and nearby reports</Text>
        <Text style={styles.mapDescription}>
          Community report locations and geographic context will appear here when available.
        </Text>
      </View>

      <View style={styles.contextCard}>
        <View style={styles.contextHeading}>
          <MaterialIcons name="info-outline" size={22} color={palette.primary} />
          <Text style={styles.sectionTitle}>Area safety context</Text>
        </View>
        <Text style={styles.bodyText}>
          Report summaries and data coverage will appear here. No visible reports should be treated
          as proof that an area is safe.
        </Text>
      </View>

      <RouteResultsPlaceholder />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: palette.text, fontSize: 32, lineHeight: 38, fontWeight: '900' },
  iconButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.72 },
  mapSurface: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
  },
  mapIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: palette.surface,
  },
  mapTitle: { color: palette.text, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  mapDescription: {
    maxWidth: 320,
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  contextCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  contextHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { flex: 1, color: palette.text, fontSize: 18, fontWeight: '800' },
  bodyText: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
});
