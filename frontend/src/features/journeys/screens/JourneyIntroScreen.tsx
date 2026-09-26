import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { palette, radius, spacing } from '@/src/theme';
import { IncomingRouteParams } from '../types';

interface Props {
  params: IncomingRouteParams;
  onConsented: () => void;
}

const EXPLAINER_ITEMS: { icon: keyof typeof MaterialIcons.glyphMap; text: string }[] = [
  { icon: 'my-location', text: 'Your location is tracked only while this journey is active.' },
  { icon: 'route', text: 'We compare your position to the planned route to detect deviations.' },
  { icon: 'check-circle', text: 'You can check in at any time to confirm you are safe.' },
  { icon: 'flag', text: 'Tracking stops automatically when you arrive, or when you end it manually.' },
  { icon: 'fact-check', text: 'You always confirm the final outcome yourself \u2014 arrival alone is never assumed to mean safe.' },
];

export default function JourneyIntroScreen({ params, onConsented }: Props) {
  const [requesting, setRequesting] = useState(false);

  const handleEnableAndContinue = async () => {
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'HerPath needs location access to track your journey and detect route deviations. You can enable it in your device settings.'
        );
        return;
      }
      onConsented();
    } finally {
      setRequesting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.brandMark}>
        <MaterialIcons name="shield" size={28} color={palette.white} />
      </View>
      <Text style={styles.brandName}>HerPath</Text>
      <Text style={styles.tagline}>Community-informed safety, every step of the way.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Before you start this journey</Text>
        <Text style={styles.sectionBody}>
          Here&apos;s exactly what happens once you tap Start Journey:
        </Text>

        {EXPLAINER_ITEMS.map((item) => (
          <View key={item.text} style={styles.explainerRow}>
            <View style={styles.explainerIcon}>
              <MaterialIcons name={item.icon} size={18} color={palette.primary} />
            </View>
            <Text style={styles.explainerText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.consentCard}>
        <MaterialIcons name="info-outline" size={18} color={palette.primary} />
        <Text style={styles.consentText}>
          By continuing, you agree to share your live location with HerPath for the duration of
          this journey only. Location sharing stops when the journey ends.
        </Text>
      </View>

      <Pressable
        style={[styles.continueButton, requesting && styles.disabled]}
        disabled={requesting}
        onPress={handleEnableAndContinue}>
        <Text style={styles.continueText}>
          {requesting ? 'Requesting permission\u2026' : 'Enable Location & Continue'}
        </Text>
      </Pressable>

      <Text style={styles.destinationNote}>
        Destination: {params.destination.address ?? 'Selected destination'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  brandMark: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: palette.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  brandName: { fontSize: 24, fontWeight: '800', color: palette.text },
  tagline: { fontSize: 13, color: palette.textMuted, marginTop: 4, marginBottom: spacing.xl, textAlign: 'center' },
  card: {
    width: '100%',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 4 },
  sectionBody: { fontSize: 13, color: palette.textMuted, marginBottom: spacing.sm },
  explainerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  explainerIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  explainerText: { flex: 1, fontSize: 13, color: palette.text, lineHeight: 18 },
  consentCard: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  consentText: { flex: 1, fontSize: 12, color: palette.textMuted, lineHeight: 17 },
  continueButton: {
    width: '100%',
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  continueText: { color: palette.white, fontWeight: '700', fontSize: 15 },
  destinationNote: { fontSize: 12, color: palette.textMuted, marginTop: spacing.md },
});