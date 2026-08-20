import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { journeyApi } from '../api/journeyApi';
import { Journey } from '../types';
import JourneyMap from '../components/JourneyMap';
import { useAuth } from '../../auth/auth-provider';

export default function JourneyDetailsScreen({ id }: { id: string }) {
  const { accessToken, status } = useAuth();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'ready' || !accessToken) return;
    journeyApi.getById(accessToken, id).then(setJourney).finally(() => setLoading(false));
  }, [id, status, accessToken]);

  if (loading || status !== 'ready') return <ActivityIndicator style={{ flex: 1 }} />;
  if (!journey) return <Text>Journey not found.</Text>;

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
  section: { padding: 16 },
  row: { fontSize: 14, marginBottom: 8 },
});