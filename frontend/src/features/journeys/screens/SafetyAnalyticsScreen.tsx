import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet, Text, Pressable } from 'react-native';
import StatCard from '../components/StatCard';
import ProgressBarStat from '../components/ProgressBarStat';
import { journeyApi } from '../api/journeyApi';
import { AnalyticsSummary } from '../types';
import { useAuth } from '../../auth/auth-provider';
import { palette, spacing } from '@/src/theme';
import { messageFromError } from '@/src/services/api/errors';

export default function SafetyAnalyticsScreen() {
  const { accessToken, status } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await journeyApi.analyticsSummary(accessToken);
      setSummary(data);
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
        <Pressable accessibilityRole="button" accessibilityLabel="Retry loading analytics" onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!summary) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <StatCard label="Active" value={summary.activeJourneys} color={palette.primary} />
        <StatCard label="Completed" value={summary.completedJourneys} />
      </View>
      <View style={styles.row}>
        <StatCard label="Safe" value={summary.safeJourneys} color={palette.primary} />
        <StatCard label="Incidents" value={summary.incidentJourneys} color={palette.error} />
        <StatCard label="Unknown" value={summary.unknownJourneys} color={palette.textMuted} />
      </View>
      <ProgressBarStat label="Safe (of completed)" percentage={summary.safePercentage} color={palette.primary} />
      <ProgressBarStat label="Incident (of completed)" percentage={summary.incidentPercentage} color={palette.error} />
      <ProgressBarStat label="Unknown (of completed)" percentage={summary.unknownPercentage} color={palette.textMuted} />
      <ProgressBarStat label="Observed incident rate (resolved only)" percentage={summary.observedIncidentRate} color={palette.accent} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  row: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: palette.textMuted, marginBottom: spacing.sm, textAlign: 'center' },
  retryText: { color: palette.primary, fontWeight: '700' },
});