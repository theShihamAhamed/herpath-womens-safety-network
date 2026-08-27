import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/features/auth/auth-provider';
import { palette, radius, spacing } from '@/src/theme';

import { ModerationCaseCard } from '../components/moderation-case-card';
import { ModerationFilterBar } from '../components/moderation-filter-bar';
import { useModerationQueue } from '../hooks/use-moderation-queue';
import type { ModerationQueueFilters } from '../moderation.types';

const DEFAULT_FILTERS: ModerationQueueFilters = {
  state: 'QUEUED',
  assignment: 'UNASSIGNED',
};

export function ModerationDashboardScreen() {
  const router = useRouter();
  const { accessToken, retry: retrySession } = useAuth();
  const [filters, setFilters] = useState<ModerationQueueFilters>(DEFAULT_FILTERS);
  const queue = useModerationQueue(accessToken, filters);

  if (!accessToken) return null;

  return (
    <Screen contentStyle={styles.screen}>
      <FlatList
        data={queue.cases}
        keyExtractor={(moderationCase) => moderationCase.id}
        contentContainerStyle={[
          styles.content,
          queue.cases.length === 0 && styles.contentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={queue.refreshing}
            tintColor={palette.primary}
            onRefresh={() => void queue.refresh()}
          />
        }
        ListHeaderComponent={
          <DashboardHeader
            filters={filters}
            filtersDisabled={queue.refreshing}
            onChangeFilters={setFilters}
          />
        }
        ListEmptyComponent={
          <QueueEmptyState
            error={queue.error}
            loading={queue.loading}
            retryLabel={queue.errorStatus === 401 ? 'Recover session' : 'Retry'}
            onRetry={() =>
              void (queue.errorStatus === 401 ? retrySession() : queue.reload())
            }
          />
        }
        ListFooterComponent={
          queue.cases.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.loadedCount}>{queue.cases.length} cases loaded</Text>
              {queue.error ? (
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {queue.error}
                </Text>
              ) : null}
              {queue.hasMore ? (
                <PrimaryButton
                  label={queue.loadingMore ? 'Loading more cases…' : 'Load more cases'}
                  loading={queue.loadingMore}
                  variant="secondary"
                  onPress={() => void queue.loadMore()}
                />
              ) : null}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ModerationCaseCard
            moderationCase={item}
            onReview={() =>
              router.push(`/moderator/cases/${encodeURIComponent(item.id)}` as Href)
            }
          />
        )}
      />
    </Screen>
  );
}

function DashboardHeader({
  filters,
  filtersDisabled,
  onChangeFilters,
}: {
  filters: ModerationQueueFilters;
  filtersDisabled: boolean;
  onChangeFilters(filters: ModerationQueueFilters): void;
}) {
  return (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MODERATOR ACCESS</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Moderation
        </Text>
        <Text style={styles.subtitle}>
          Review community reports through a privacy-conscious, audited workflow.
        </Text>
      </View>

      <View accessible accessibilityLabel="Moderator access active" style={styles.accessCard}>
        <View style={styles.accessIcon}>
          <MaterialIcons name="verified-user" size={24} color={palette.primary} />
        </View>
        <View style={styles.accessCopy}>
          <Text style={styles.accessTitle}>Moderator access active</Text>
          <Text style={styles.accessText}>
            Every moderation request is also protected by backend role authorization.
          </Text>
        </View>
      </View>

      <ModerationFilterBar
        filters={filters}
        disabled={filtersDisabled}
        onChange={onChangeFilters}
      />
    </View>
  );
}

function QueueEmptyState({
  error,
  loading,
  retryLabel,
  onRetry,
}: {
  error: string | null;
  loading: boolean;
  retryLabel: string;
  onRetry(): void;
}) {
  if (loading) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.centerState}>
        <ActivityIndicator color={palette.primary} size="large" />
        <Text style={styles.stateText}>Loading moderation cases…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.centerState}>
        <MaterialIcons name="error-outline" size={32} color={palette.error} />
        <Text style={styles.errorText}>{error}</Text>
        <PrimaryButton label={retryLabel} onPress={onRetry} />
      </View>
    );
  }

  return (
    <View style={styles.centerState}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name="inbox" size={32} color={palette.primary} />
      </View>
      <Text style={styles.emptyTitle}>No cases match these filters</Text>
      <Text style={styles.stateText}>Try another assignment, state, or priority filter.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl },
  contentEmpty: { flexGrow: 1 },
  headerContent: { gap: spacing.lg, marginBottom: spacing.sm },
  header: { gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: palette.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: palette.textMuted, fontSize: 16, lineHeight: 24, maxWidth: 520 },
  accessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  accessIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: palette.surface,
  },
  accessCopy: { flex: 1, gap: spacing.xs },
  accessTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  accessText: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  centerState: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: palette.surfaceMuted,
  },
  emptyTitle: { color: palette.text, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  stateText: { color: palette.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  errorText: { color: palette.error, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  footer: { gap: spacing.md, paddingTop: spacing.md },
  loadedCount: { color: palette.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
