import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/screen';
import { RoutePlanningEntry, RouteProvider } from '@/src/features/routing';
import { palette, radius, spacing } from '@/src/theme';

import { MapScreen } from './map-screen';
import { useUserLocation } from './use-user-location';

export function MapHomeScreen() {
  return (
    <RouteProvider>
      <MapHomeContent />
    </RouteProvider>
  );
}

function MapHomeContent() {
  const router = useRouter();
  const { location } = useUserLocation();

  return (
    <Screen contentStyle={styles.content}>
      <MapScreen controlsTopOffset={144} />

      <View pointerEvents="box-none" style={styles.topOverlay}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel="HerPath community safety map"
              style={styles.brandMark}>
              <MaterialIcons name="shield" size={20} color={palette.white} />
              <Text style={styles.brandName}>HerPath</Text>
            </View>
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

        <RoutePlanningEntry userLocation={location} />
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
  headerCopy: { flex: 1 },
  brandMark: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
  },
  brandName: { color: palette.white, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
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
