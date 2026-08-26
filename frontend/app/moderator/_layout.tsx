import { Stack } from 'expo-router';

export default function ModeratorLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Moderation' }} />
      <Stack.Screen name="cases/[caseId]/index" options={{ title: 'Case review' }} />
      <Stack.Screen name="cases/[caseId]/decision" options={{ title: 'Record decision' }} />
    </Stack>
  );
}
