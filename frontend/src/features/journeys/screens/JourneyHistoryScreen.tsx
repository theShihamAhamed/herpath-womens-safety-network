import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, ActivityIndicator, Text, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import JourneyHistoryCard from '../components/JourneyHistoryCard';
import { journeyApi } from '../api/journeyApi';
import { JourneyHistoryItem } from '../types';
import { useAuth } from '../../auth/auth-provider';
import { palette, spacing } from '@/src/theme';
import { messageFromError } from '@/src/services/api/errors';

export default function JourneyHistoryScreen() {
  const router = useRouter();
  const { accessToken, status } = useAuth();
  const [journeys, setJourneys] = useState<JourneyHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await journeyApi.history(accessToken);
      setJourneys(data);
    } catch (e) {
      setLoadError(messageFromError(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (status !== 'ready') return;
    void (async () => {
      await load();
    })();
  }, [status, load]);

  if (status !== 'ready' || loading) return <ActivityIndicator style={{ flex: 1 }} />;

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry loading journey history" onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: spacing.md }}
      data={journeys}
      keyExtractor={(j) => j._id}
      ListEmptyComponent={<Text style={styles.emptyText}>No journeys yet.</Text>}
      renderItem={({ item }) => (
        <JourneyHistoryCard
          item={item}
          onPress={() => router.push({ pathname: '/journey/[id]', params: { id: item._id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: palette.textMuted, marginBottom: spacing.sm, textAlign: 'center' },
  retryText: { color: palette.primary, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 40, color: palette.textMuted },
});