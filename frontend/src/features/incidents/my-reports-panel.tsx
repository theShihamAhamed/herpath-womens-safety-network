import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { palette, radius, spacing } from '@/src/theme';

import { incidentApi } from './incident-api';
import type { IncidentStatus, OwnerIncident } from './incident.types';

interface MyReportsPanelProps {
  accessToken: string;
  actorId: string;
  onClose(): void;
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  PENDING: 'Pending review',
  PUBLISHED_UNVERIFIED: 'Unverified community report',
  COMMUNITY_SUPPORTED: 'Community supported',
  MODERATOR_REVIEWED: 'Moderator reviewed',
  DISPUTED: 'Disputed',
  REJECTED: 'Not published',
  ARCHIVED: 'Archived',
};

function displayLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');
}

export function MyReportsPanel({ accessToken, actorId, onClose }: MyReportsPanelProps) {
  const [items, setItems] = useState<OwnerIncident[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFirstPage = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await incidentApi.mine(accessToken);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch {
      setErrorMessage('Your reports could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    void loadFirstPage();
  }, [actorId, loadFirstPage]);

  async function loadMore(): Promise<void> {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const page = await incidentApi.mine(accessToken, 20, nextCursor);
      setItems((current) => {
        const existingIds = new Set(current.map((incident) => incident.id));
        return [...current, ...page.items.filter((incident) => !existingIds.has(incident.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      setErrorMessage('More reports could not be loaded. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>My Reports</Text>
          <Text style={styles.subtitle}>Reports owned by your current HerPath session.</Text>
        </View>
        <Pressable
          accessibilityLabel="Close My Reports"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color={palette.text} />
        </Pressable>
      </View>

      {isLoading && items.length === 0 ? (
        <View accessibilityLiveRegion="polite" style={styles.centerState}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.stateText}>Loading your reports…</Text>
        </View>
      ) : errorMessage && items.length === 0 ? (
        <View accessibilityLiveRegion="polite" style={styles.centerState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <PrimaryButton label="Retry" onPress={() => void loadFirstPage()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              tintColor={palette.primary}
              onRefresh={() => void loadFirstPage(true)}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.stateText}>Reports submitted by this account will appear here.</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              {nextCursor ? (
                <PrimaryButton
                  label={isLoadingMore ? 'Loading more…' : 'Load more reports'}
                  loading={isLoadingMore}
                  variant="secondary"
                  onPress={() => void loadMore()}
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) => <ReportHistoryCard incident={item} />}
        />
      )}
    </View>
  );
}

function ReportHistoryCard({ incident }: { incident: OwnerIncident }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{displayLabel(incident.category)}</Text>
        <Text style={styles.status}>{STATUS_LABELS[incident.status]}</Text>
      </View>
      <Text style={styles.detail}>
        Occurred {new Date(incident.occurredAt).toLocaleString()}
      </Text>
      <Text style={styles.detail}>Severity: {displayLabel(incident.severity)}</Text>
      <Text style={styles.detail}>
        Location: {incident.locationMode === 'EXACT_PRIVATE' ? 'Exact location kept private' : 'Approximate area only'}
      </Text>
      {incident.description ? <Text style={styles.description}>{incident.description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  title: { color: palette.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  closeButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  centerState: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  stateText: { color: palette.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  errorText: { color: palette.error, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  emptyTitle: { color: palette.text, fontSize: 20, fontWeight: '800' },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  cardHeading: { gap: spacing.xs },
  cardTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  status: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  detail: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  description: { color: palette.text, fontSize: 14, lineHeight: 21 },
  footer: { gap: spacing.md, paddingTop: spacing.md },
});
