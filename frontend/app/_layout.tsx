import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/src/features/auth/auth-provider';
import { SessionGate } from '@/src/features/auth/session-gate';
import { palette } from '@/src/theme';

export default function RootLayout() {
  return (
    <ThemeProvider
      value={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: palette.primary,
          background: palette.background,
          card: palette.surface,
          text: palette.text,
          border: palette.border,
        },
      }}>
      <AuthProvider>
        <SessionAwareNavigator />
      </AuthProvider>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

function SessionAwareNavigator() {
  const { status, actor } = useAuth();

  if (status !== 'ready' || !actor) return <SessionGate />;

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      <Stack.Protected guard={actor.accountType === 'ANONYMOUS'}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={actor.role === 'MODERATOR'}>
        <Stack.Screen name="moderator" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
