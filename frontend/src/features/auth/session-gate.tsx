import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { Screen } from '@/src/components/screen';
import { palette, spacing } from '@/src/theme';

import { useAuth } from './auth-provider';

export function SessionGate() {
  const { status, errorMessage, retry } = useAuth();

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <Text style={styles.name}>HerPath</Text>
        <Text style={styles.tagline}>Community-informed safety context for every journey.</Text>
      </View>

      {status === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator color={palette.primary} size="large" />
          <Text style={styles.stateText}>Restoring your private session…</Text>
        </View>
      ) : (
        <View style={styles.state}>
          <Text style={styles.errorTitle}>We could not connect to HerPath</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <PrimaryButton label="Try again" onPress={() => void retry()} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between', paddingVertical: spacing.xxl },
  brand: { marginTop: spacing.xxl, gap: spacing.sm },
  name: { color: palette.primary, fontSize: 42, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: palette.textMuted, fontSize: 17, lineHeight: 25, maxWidth: 340 },
  state: { gap: spacing.md },
  stateText: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  errorTitle: { color: palette.text, fontSize: 21, fontWeight: '700' },
});
