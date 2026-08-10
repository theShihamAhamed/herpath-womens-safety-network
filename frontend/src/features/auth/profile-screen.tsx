import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { Screen } from '@/src/components/screen';
import { palette, radius, spacing } from '@/src/theme';

import { useAuth } from './auth-provider';

export function ProfileScreen() {
  const router = useRouter();
  const { actor, logout, operation } = useAuth();

  if (!actor) return null;

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PROFILE</Text>
        <Text style={styles.title}>
          {actor.accountType === 'ANONYMOUS' ? 'Anonymous access' : actor.name}
        </Text>
        <Text style={styles.subtitle}>
          {actor.accountType === 'ANONYMOUS'
            ? 'You can use HerPath without sharing a public identity.'
            : 'Your registered HerPath account is active.'}
        </Text>
      </View>

      <View style={styles.card}>
        <InfoRow label="Account" value={actor.accountType === 'ANONYMOUS' ? 'Anonymous' : 'Registered'} />
        <InfoRow label="Role" value={actor.role === 'MODERATOR' ? 'Moderator' : 'User'} />
        {actor.email ? <InfoRow label="Email" value={actor.email} /> : null}
      </View>

      {actor.accountType === 'ANONYMOUS' ? (
        <View style={styles.actions}>
          <PrimaryButton label="Sign In" onPress={() => router.push('/(auth)/sign-in')} />
          <PrimaryButton
            label="Create Account"
            variant="secondary"
            onPress={() => router.push('/(auth)/sign-up')}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          {actor.role === 'MODERATOR' ? (
            <PrimaryButton
              label="Open Moderator Area"
              variant="secondary"
              onPress={() => router.push('/moderator')}
            />
          ) : null}
          <PrimaryButton
            label="Log Out"
            onPress={() => void logout()}
            loading={operation === 'logout'}
          />
        </View>
      )}
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingVertical: spacing.xl },
  header: { gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: palette.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { color: palette.textMuted, fontSize: 14 },
  rowValue: { color: palette.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  actions: { gap: spacing.md },
});
