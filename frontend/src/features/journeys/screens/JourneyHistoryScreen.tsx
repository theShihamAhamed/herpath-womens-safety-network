import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import JourneyHistoryCard from '../components/JourneyHistoryCard';
import { journeyApi } from '../api/journeyApi';
import { JourneyHistoryItem } from '../types';
import { useAuth } from '../../auth/auth-provider';

export default function JourneyHistoryScreen() {
  const router = useRouter();
  const { accessToken, status } = useAuth();
  const [journeys, setJourneys] = useState<JourneyHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await journeyApi.history(accessToken);
      setJourneys(data);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { if (status === 'ready') load(); }, [status, load]);

  if (status !== 'ready' || loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={journeys}
      keyExtractor={(j) => j._id}
      ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40 }}>No journeys yet.</Text>}
      renderItem={({ item }) => (
        <JourneyHistoryCard
          item={item}
          onPress={() => router.push({ pathname: '/journey/[id]', params: { id: item._id } })}
        />
      )}
    />
  );
}
