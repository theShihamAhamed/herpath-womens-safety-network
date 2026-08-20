import { Stack } from 'expo-router';

export default function JourneyLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="tracking" options={{ title: 'Journey' }} />
      <Stack.Screen name="outcome" options={{ title: 'Journey Outcome' }} />
      <Stack.Screen name="history" options={{ title: 'Journey History' }} />
      <Stack.Screen name="[id]" options={{ title: 'Journey Details' }} />
      <Stack.Screen name="analytics" options={{ title: 'Safety Analytics' }} />
    </Stack>
  );
}