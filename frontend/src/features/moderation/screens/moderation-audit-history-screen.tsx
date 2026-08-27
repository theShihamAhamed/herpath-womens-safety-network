import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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

import { useModerationAudits } from '../hooks/use-moderation-audits';
import {
  INCIDENT_COMMUNITY_STATE_LABELS,
  INCIDENT_MODERATION_STATE_LABELS,
  INCIDENT_VISIBILITY_LABELS,
  MODERATION_AUDIT_ACTION_LABELS,
  MODERATION_AUDIT_ACTOR_LABELS,
  MODERATION_CASE_STATE_LABELS,
  MODERATION_PRIORITY_LABELS,
} from '../moderation-labels';
import type { ModerationAuditHistoryItem } from '../moderation.types';

interface ModerationAuditHistoryScreenProps {
  caseId: string | null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unavailable';
}

export function ModerationAuditHistoryScreen({ caseId }: ModerationAuditHistoryScreenProps) {
  const { accessToken, retry: retrySession, status } = useAuth();
  const auditState = useModerationAudits(accessToken, caseId);

  if (status === 'loading' || (status === 'ready' && auditState.loading)) {
    return <AuditLoadingState />;
  }

  if (status === 'error') {
    return (
      <AuditUnavailableState
        message="Your session could not be restored. Return to Profile and try again."
        onRetry={() => void retrySession()}
      />
    );
  }

  if (auditState.error && auditState.audits.length === 0) {
    return (
      <AuditUnavailableState
        message={auditState.error}
        onRetry={() => {
          if (auditState.errorStatus === 401) void retrySession();
          else void auditState.reload();
        }}
      />
    );
  }

  if (!accessToken) {
    return (
      <AuditUnavailableState
        message="Your moderator session is unavailable. Return to Profile and try again."
        onRetry={() => void retrySession()}
      />
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      <FlatList
        data={auditState.audits}
        keyExtractor={(audit) => audit.id}
        contentContainerStyle={[
          styles.content,
          auditState.audits.length === 0 && styles.emptyContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={auditState.refreshing}
            tintColor={palette.primary}
            onRefresh={() => void auditState.refresh()}
          />
        }
        ListHeaderComponent={
          <AuditHeader
            error={auditState.error}
            onRetry={() => void auditState.refresh()}
          />
        }
        ListEmptyComponent={<AuditEmptyState />}
        renderItem={({ item, index }) => (
          <AuditTimelineItem
            audit={item}
            isLast={index === auditState.audits.length - 1}
          />
        )}
      />
    </Screen>
  );
}

function AuditHeader({ error, onRetry }: { error: string | null; onRetry(): void }) {
  return (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>GOVERNANCE HISTORY</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Audit history
        </Text>
        <Text style={styles.subtitle}>
          Review append-only case events from oldest to newest. Entries identify the actor role,
          never the moderator or reporter.
        </Text>
      </View>

      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.inlineError}>
          <View style={styles.inlineErrorCopy}>
            <MaterialIcons name="error-outline" size={20} color={palette.error} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
          <PrimaryButton label="Retry" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

function AuditLoadingState() {
  return (
    <Screen contentStyle={styles.centerState}>
      <ActivityIndicator color={palette.primary} size="large" />
      <Text accessibilityLiveRegion="polite" style={styles.stateText}>
        Loading audit history…
      </Text>
    </Screen>
  );
}

function AuditUnavailableState({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <Screen contentStyle={styles.centerState}>
      <View style={styles.stateIcon}>
        <MaterialIcons name="history" size={34} color={palette.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        Audit history unavailable
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.stateText}>
        {message}
      </Text>
      <PrimaryButton label="Try again" onPress={onRetry} />
    </Screen>
  );
}

function AuditEmptyState() {
  return (
    <View style={styles.centerState}>
      <View style={styles.stateIcon}>
        <MaterialIcons name="history" size={34} color={palette.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        No audit events recorded
      </Text>
      <Text style={styles.stateText}>This case does not have any governance events yet.</Text>
    </View>
  );
}

function AuditTimelineItem({
  audit,
  isLast,
}: {
  audit: ModerationAuditHistoryItem;
  isLast: boolean;
}) {
  const previousCaseState = audit.previousCaseState;
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineMarker}>
        <View style={styles.timelineDot} />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>

      <View style={styles.auditCard}>
        <View style={styles.auditHeading}>
          <View style={styles.auditTitleGroup}>
            <Text style={styles.auditAction}>{MODERATION_AUDIT_ACTION_LABELS[audit.action]}</Text>
            <Text style={styles.auditDate}>{formatDate(audit.createdAt)}</Text>
          </View>
          <View style={styles.actorBadge}>
            <Text style={styles.actorText}>{MODERATION_AUDIT_ACTOR_LABELS[audit.actorType]}</Text>
          </View>
        </View>

        <View style={styles.transitionList}>
          <TransitionRow
            label="Case state"
            previous={
              previousCaseState
                ? MODERATION_CASE_STATE_LABELS[previousCaseState.state]
                : 'Not created'
            }
            next={MODERATION_CASE_STATE_LABELS[audit.newCaseState.state]}
          />
          <TransitionRow
            label="Priority"
            previous={
              previousCaseState
                ? MODERATION_PRIORITY_LABELS[previousCaseState.priority]
                : 'Not set'
            }
            next={MODERATION_PRIORITY_LABELS[audit.newCaseState.priority]}
          />
          <TransitionRow
            label="Case revision"
            previous={previousCaseState ? previousCaseState.caseRevision.toString() : '—'}
            next={audit.newCaseState.caseRevision.toString()}
          />
          <TransitionRow
            label="Visibility"
            previous={
              INCIDENT_VISIBILITY_LABELS[audit.previousIncidentLifecycle.visibilityState]
            }
            next={INCIDENT_VISIBILITY_LABELS[audit.newIncidentLifecycle.visibilityState]}
          />
          <TransitionRow
            label="Community"
            previous={
              INCIDENT_COMMUNITY_STATE_LABELS[audit.previousIncidentLifecycle.communityState]
            }
            next={INCIDENT_COMMUNITY_STATE_LABELS[audit.newIncidentLifecycle.communityState]}
          />
          <TransitionRow
            label="Moderation"
            previous={
              INCIDENT_MODERATION_STATE_LABELS[audit.previousIncidentLifecycle.moderationState]
            }
            next={INCIDENT_MODERATION_STATE_LABELS[audit.newIncidentLifecycle.moderationState]}
          />
          <TransitionRow
            label="Lifecycle revision"
            previous={audit.previousIncidentLifecycle.lifecycleRevision.toString()}
            next={audit.newIncidentLifecycle.lifecycleRevision.toString()}
          />
        </View>
      </View>
    </View>
  );
}

function TransitionRow({
  label,
  previous,
  next,
}: {
  label: string;
  previous: string;
  next: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${previous}, changed to ${next}`}
      style={styles.transitionRow}>
      <Text style={styles.transitionLabel}>{label}</Text>
      <View style={styles.transitionValues}>
        <Text style={styles.transitionPrevious}>{previous}</Text>
        <MaterialIcons name="arrow-forward" size={16} color={palette.textMuted} />
        <Text style={styles.transitionNext}>{next}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  emptyContent: { flexGrow: 1 },
  headerContent: { gap: spacing.md, marginBottom: spacing.lg },
  header: { gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: palette.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  inlineError: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.error,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  inlineErrorCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  inlineErrorText: { flex: 1, color: palette.error, fontSize: 14, lineHeight: 20 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineMarker: { width: 24, alignItems: 'center' },
  timelineDot: {
    width: 12,
    height: 12,
    marginTop: spacing.lg,
    borderWidth: 3,
    borderColor: palette.background,
    borderRadius: 6,
    backgroundColor: palette.primary,
  },
  timelineLine: { flex: 1, width: 2, minHeight: spacing.md, backgroundColor: palette.border },
  auditCard: {
    flex: 1,
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  auditHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  auditTitleGroup: { flex: 1, gap: spacing.xs },
  auditAction: { color: palette.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  auditDate: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  actorBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceMuted,
  },
  actorText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  transitionList: { gap: spacing.sm },
  transitionRow: { gap: spacing.xs },
  transitionLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  transitionValues: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  transitionPrevious: { flex: 1, color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  transitionNext: {
    flex: 1,
    color: palette.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  centerState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: palette.surfaceMuted,
  },
  stateTitle: { color: palette.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  stateText: { color: palette.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
