import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { journeyApi } from '../api/journeyApi';
import { Journey } from '../types';
import JourneyMap from '../components/JourneyMap';
import { useAuth } from '../../auth/auth-provider';
import { palette, spacing } from '@/src/theme';
import { messageFromError } from '@/src/services/api/errors';

export default function JourneyDetailsScreen({ id }: { id: string }) {
  const { accessToken, status } = useAuth();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (status !== 'ready' || !accessToken) return;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const data = await journeyApi.getById(accessToken, id);
      setJourney(data);
    } catch (e) {
      if (e instanceof Error && /not found/i.test(e.message)) {
        setNotFound(true);
      } else {
        setLoadError(messageFromError(e));
      }
    } finally {
      setLoading(false);
    }
  }, [id, status, accessToken]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  if (loading || status !== 'ready') return <ActivityIndicator style={{ flex: 1 }} />;

  if (notFound) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>This journey could not be found.</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry loading journey details" onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!journey) return null;

  return (
    <ScrollView>
      <View style={{ height: 260 }}>
        <JourneyMap
          origin={journey.origin}
          destination={journey.destination}
          routePath={[]}
          currentLocation={null}
          travelledPath={journey.currentPath}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.row}>Start: {journey.startTime ? new Date(journey.startTime).toLocaleString() : '-'}</Text>
        <Text style={styles.row}>End: {journey.endTime ? new Date(journey.endTime).toLocaleString() : '-'}</Text>
        <Text style={styles.row}>Distance: {Math.round(journey.distanceTravelled)} m</Text>
        <Text style={styles.row}>Duration: {Math.round(journey.duration / 60)} min</Text>
        <Text style={styles.row}>Check-ins: {journey.checkIns.length}</Text>
        <Text style={styles.row}>Deviation: {journey.deviationDetected ? 'Detected' : 'None'}</Text>
        <Text style={styles.row}>Outcome: {journey.outcome ?? 'UNKNOWN'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { padding: spacing.md },
  row: { fontSize: 14, marginBottom: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: palette.textMuted, marginBottom: spacing.sm, textAlign: 'center' },
  retryText: { color: palette.primary, fontWeight: '700' },
});