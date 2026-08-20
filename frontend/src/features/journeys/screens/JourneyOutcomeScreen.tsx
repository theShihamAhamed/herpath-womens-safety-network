import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { journeyApi } from '../api/journeyApi';
import { useAuth } from '../../auth/auth-provider';

export default function JourneyOutcomeScreen({ journeyId }: { journeyId: string }) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const submit = async (outcome: 'SAFE_CONFIRMED' | 'INCIDENT_REPORTED' | 'UNKNOWN') => {
    if (!accessToken) return;
    setLoading(true);
    try {
      await journeyApi.setOutcome(accessToken, journeyId, outcome);
    } finally {
      setLoading(false);
      router.replace('/journey/history');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Did you arrive safely?</Text>
      <Pressable style={[styles.btn, styles.safe]} disabled={loading} onPress={() => submit('SAFE_CONFIRMED')}>
        <Text style={styles.btnText}>✅ Arrived Safely</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.incident]} disabled={loading} onPress={() => submit('INCIDENT_REPORTED')}>
        <Text style={styles.btnText}>⚠ Experienced Incident</Text>
      </Pressable>
      <Pressable style={styles.skip} disabled={loading} onPress={() => submit('UNKNOWN')}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 24, textAlign: 'center' },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginVertical: 8 },
  safe: { backgroundColor: '#00B894' },
  incident: { backgroundColor: '#D63031' },
  btnText: { color: '#fff', fontWeight: '600' },
  skip: { paddingVertical: 12, alignItems: 'center' },
  skipText: { color: '#666' },
});