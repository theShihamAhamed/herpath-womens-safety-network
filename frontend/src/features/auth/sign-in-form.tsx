import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/src/components/form-field';
import { PrimaryButton } from '@/src/components/primary-button';
import { Screen } from '@/src/components/screen';
import { messageFromError } from '@/src/services/api/errors';
import { palette, spacing } from '@/src/theme';

import { useAuth } from './auth-provider';
import { validateSignIn } from './validation';

export function SignInForm() {
  const router = useRouter();
  const { signIn, operation } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submitting = operation === 'signIn';

  async function submit() {
    if (operation) return;
    const validationError = validateSignIn({ email, password });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    try {
      await signIn({ email, password });
      router.replace('/(tabs)/profile');
    } catch (submitError) {
      setError(messageFromError(submitError));
    }
  }

  return (
    <Screen scroll keyboardAvoiding contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>WELCOME BACK</Text>
        <Text style={styles.title}>Sign in to HerPath</Text>
        <Text style={styles.subtitle}>Your anonymous access remains available without signing in.</Text>
      </View>

      <View style={styles.form}>
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="Your password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Sign In"
          onPress={() => void submit()}
          loading={submitting}
          disabled={operation !== null}
        />
      </View>

      <Text style={styles.footer}>
        Need an account?{' '}
        <Link href="/(auth)/sign-up" style={styles.link}>
          Create one
        </Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingVertical: spacing.xl },
  header: { gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: palette.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  form: { gap: spacing.md },
  error: { color: palette.error, fontSize: 14, lineHeight: 20 },
  footer: { color: palette.textMuted, textAlign: 'center', fontSize: 15 },
  link: { color: palette.primary, fontWeight: '700' },
});
