import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/src/components/form-field';
import { PrimaryButton } from '@/src/components/primary-button';
import { Screen } from '@/src/components/screen';
import { messageFromError } from '@/src/services/api/errors';
import { palette, spacing } from '@/src/theme';

import { useAuth } from './auth-provider';
import { validateSignUp } from './validation';

export function SignUpForm() {
  const router = useRouter();
  const { signUp, operation } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submitting = operation === 'signUp';

  async function submit() {
    if (operation) return;
    const validationError = validateSignUp({ name, email, password, confirmPassword });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    try {
      await signUp({ name, email, password });
      router.replace('/(tabs)/profile');
    } catch (submitError) {
      setError(messageFromError(submitError));
    }
  }

  return (
    <Screen scroll keyboardAvoiding contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CREATE ACCOUNT</Text>
        <Text style={styles.title}>Join HerPath</Text>
        <Text style={styles.subtitle}>Create a registered account without changing your access to the main app.</Text>
      </View>

      <View style={styles.form}>
        <FormField
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          textContentType="name"
          placeholder="Your name"
        />
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
          textContentType="newPassword"
          placeholder="4 to 128 characters"
        />
        <FormField
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="Repeat your password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Create Account"
          onPress={() => void submit()}
          loading={submitting}
          disabled={operation !== null}
        />
      </View>

      <Text style={styles.footer}>
        Already registered?{' '}
        <Link href="/(auth)/sign-in" style={styles.link}>
          Sign in
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
