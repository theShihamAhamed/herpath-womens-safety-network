import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { journeyApi } from '../api/journeyApi';
import { useAuth } from '../../auth/auth-provider';
import FeedbackOverlay from '../components/FeedbackOverlay';
import { palette, radius, spacing } from '@/src/theme';

export default function JourneyOutcomeScreen({ journeyId }: { journeyId: string }) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ icon: keyof typeof MaterialIcons.glyphMap; color: string; title: string; message: string } | null>(null);

  const submit = async (outcome: 'SAFE_CONFIRMED' | 'INCIDENT_REPORTED' | 'UNKNOWN') => {
    if (!accessToken) return;
    setLoading(true);
    try {
      await journeyApi.setOutcome(accessToken, journeyId, outcome);
    } finally {
      setLoading(false);
      if (outcome === 'SAFE_CONFIRMED') {
        setFeedback({ icon: 'check-circle', color: palette.primary, title: 'Great, you\u2019re safe', message: 'Your journey has been marked as safe.' });
      } else if (outcome === 'INCIDENT_REPORTED') {
        setFeedback({ icon: 'report-problem', color: palette.error, title: 'Incident recorded', message: 'This journey has been flagged for safety analytics.' });
      } else {
        setFeedback({ icon: 'help-outline', color: palette.textMuted, title: 'Outcome skipped', message: 'This journey will be marked as unknown.' });
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Did you arrive safely?</Text>

      <Pressable style={[styles.btn, styles.safe]} disabled={loading} onPress={() => submit('SAFE_CONFIRMED')}>
        <MaterialIcons name="check-circle" size={20} color={palette.white} style={styles.btnIcon} />
        <Text style={styles.btnText}>Arrived Safely</Text>
      </Pressable>

      <Pressable style={[styles.btn, styles.incident]} disabled={loading} onPress={() => submit('INCIDENT_REPORTED')}>
        <MaterialIcons name="report-problem" size={20} color={palette.white} style={styles.btnIcon} />
        <Text style={styles.btnText}>Experienced Incident</Text>
      </Pressable>

      <Pressable style={styles.skip} disabled={loading} onPress={() => submit('UNKNOWN')}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      {feedback && (
        <FeedbackOverlay
          visible
          icon={feedback.icon}
          iconColor={feedback.color}
          title={feedback.title}
          message={feedback.message}
          onHide={() => {
            setFeedback(null);
            router.replace('/journey/history');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: palette.background },
  title: { fontSize: 21, fontWeight: '700', color: palette.text, marginBottom: spacing.xl, textAlign: 'center' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, borderRadius: radius.md, marginVertical: spacing.xs,
  },
  btnIcon: { marginRight: spacing.sm },
  safe: { backgroundColor: palette.primary },
  incident: { backgroundColor: palette.error },
  btnText: { color: palette.white, fontWeight: '700', fontSize: 15 },
  skip: { paddingVertical: spacing.md, alignItems: 'center' },
  skipText: { color: palette.textMuted, fontWeight: '600' },
});