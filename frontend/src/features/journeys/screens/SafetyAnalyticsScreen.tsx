import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import StatCard from '../components/StatCard';
import ProgressBarStat from '../components/ProgressBarStat';
import { journeyApi } from '../api/journeyApi';
import { AnalyticsSummary } from '../types';
import { useAuth } from '../../auth/auth-provider';

export default function SafetyAnalyticsScreen() {
  const { accessToken, status } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    if (status !== 'ready' || !accessToken) return;
    journeyApi.analyticsSummary(accessToken).then(setSummary);
  }, [status, accessToken]);

  if (!summary) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <StatCard label="Total" value={summary.totalJourneys} />
        <StatCard label="Safe" value={summary.safeJourneys} color="#00B894" />
        <StatCard label="Incidents" value={summary.incidentJourneys} color="#D63031" />
      </View>
      <ProgressBarStat label="Safe" percentage={summary.safePercentage} color="#00B894" />
      <ProgressBarStat label="Incident" percentage={summary.incidentPercentage} color="#D63031" />
      <ProgressBarStat label="Unknown" percentage={summary.unknownPercentage} color="#B2BEC3" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 20 },
});