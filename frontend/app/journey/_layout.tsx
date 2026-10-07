import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { palette } from '@/src/theme';

export default function JourneyLayout() {
  const router = useRouter();

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="intro" options={{ title: 'Journey Setup' }} />
      <Stack.Screen name="tracking" options={{ title: 'Journey' }} />
      <Stack.Screen
        name="outcome"
        options={{
          title: 'Journey Outcome',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to map"
              hitSlop={12}
              onPress={() => router.replace('/(tabs)/map')}
              style={styles.outcomeBack}>
              <MaterialIcons name="arrow-back" size={24} color={palette.text} />
              <Text style={styles.outcomeBackLabel}>Journey</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="history" options={{ title: 'Journey History' }} />
      <Stack.Screen name="[id]" options={{ title: 'Journey Details' }} />
      <Stack.Screen name="analytics" options={{ title: 'Safety Analytics' }} />
      
    </Stack>
  );
}

const styles = StyleSheet.create({
  outcomeBack: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  outcomeBackLabel: { color: palette.text, fontSize: 17 },
});
