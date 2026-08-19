import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/screen';
import { RoutePlanningEntry } from '@/src/features/routing';
import { palette, radius, spacing } from '@/src/theme';

import { MapScreen } from './map-screen';

export function MapHomeScreen() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <MapScreen controlsTopOffset={140} />

      <View pointerEvents="box-none" style={styles.topOverlay}>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 0 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, gap: spacing.sm, padding: spacing.md },
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
});
