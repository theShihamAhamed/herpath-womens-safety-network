import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/features/auth/auth-provider';
import { palette, radius, spacing } from '@/src/theme';

import { ModerationReasonDialog } from '../components/moderation-reason-dialog';
import {
  useModerationAction,
  type ModerationActionState,
  type ModerationWorkflowAction,
} from '../hooks/use-moderation-action';
import { useModerationCase } from '../hooks/use-moderation-case';
import {
  INCIDENT_COMMUNITY_STATE_LABELS,
  INCIDENT_FLAG_REASON_LABELS,
  INCIDENT_MODERATION_STATE_LABELS,
  INCIDENT_VISIBILITY_LABELS,
  MODERATION_ASSIGNMENT_LABELS,
  MODERATION_CASE_SOURCE_LABELS,
  MODERATION_CASE_STATE_LABELS,
  MODERATION_PRIORITY_LABELS,
  MODERATION_RESOLUTION_LABELS,
} from '../moderation-labels';
import {
  INCIDENT_FLAG_REASONS,
  type IncidentFlagReason,
  type ModerationCaseDetail,
} from '../moderation.types';

interface ModerationCaseReviewScreenProps {
  caseId: string | null;
}

interface PreparedAction {
  action: ModerationWorkflowAction | 'DECISION';
  label: string;
  variant?: 'primary' | 'secondary';
}

type ReasonAction = 'RELEASE' | 'REOPEN';

function readableEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unavailable';
}

function preparedActions(moderationCase: ModerationCaseDetail): PreparedAction[] {
  if (moderationCase.state === 'QUEUED' && moderationCase.assignment.state === 'UNASSIGNED') {
    return [{ action: 'CLAIM', label: 'Claim case' }];
  }
  if (
    moderationCase.state === 'IN_REVIEW' &&
    moderationCase.assignment.state === 'ASSIGNED_TO_ME'
  ) {
    return [
      { action: 'DECISION', label: 'Record decision' },
      { action: 'RELEASE', label: 'Release case', variant: 'secondary' },
    ];
  }
  if (moderationCase.state === 'RESOLVED') {
    return [{ action: 'REOPEN', label: 'Reopen case' }];
  }
  return [];
}

export function ModerationCaseReviewScreen({ caseId }: ModerationCaseReviewScreenProps) {
  const router = useRouter();
  const { accessToken, retry: retrySession, status } = useAuth();
  const caseState = useModerationCase(accessToken, caseId);
  const actionState = useModerationAction(accessToken, {
    refreshCase: caseState.reload,
    recoverSession: retrySession,
  });
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);

  if (status === 'loading' || (status === 'ready' && caseState.loading)) {
    return <CaseLoadingState />;
  }

  if (status === 'error') {
    return (
      <CaseUnavailableState
        message="Your session could not be restored. Return to Profile and try again."
        onRetry={() => void retrySession()}
      />
    );
  }

  if (!caseState.moderationCase) {
    return (
      <CaseUnavailableState
        message={
          caseState.error ??
          (accessToken
            ? 'This moderation case is unavailable.'
            : 'Your moderator session is unavailable. Return to Profile and try again.')
        }
        onRetry={() => void caseState.reload()}
      />
    );
  }

  const moderationCase = caseState.moderationCase;

  function confirmClaim(): void {
    Alert.alert(
      'Claim this case?',
      'The case will be assigned to you and moved into active review.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim case',
          onPress: () => void actionState.submit('CLAIM', moderationCase),
        },
      ],
    );
  }

  function submitReason(action: ReasonAction, reason: string): void {
    setReasonAction(null);
    void actionState.submit(action, moderationCase, reason);
  }

  return (
    <Screen contentStyle={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={caseState.refreshing}
            tintColor={palette.primary}
            onRefresh={() => void caseState.refresh()}
          />
        }>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MODERATION CASE</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Case review
          </Text>
          <Text style={styles.subtitle}>
            Review the privacy-safe incident context and aggregate community evidence.
          </Text>
        </View>

        {caseState.error ? (
          <View accessibilityLiveRegion="polite" style={styles.inlineError}>
            <MaterialIcons name="error-outline" size={20} color={palette.error} />
            <Text style={styles.inlineErrorText}>{caseState.error}</Text>
          </View>
        ) : null}

        <WorkflowSection moderationCase={moderationCase} />
        <IncidentSection moderationCase={moderationCase} />
        <CommunityEvidenceSection moderationCase={moderationCase} />
        <FlagSummarySection moderationCase={moderationCase} />
        <ActionPreparationSection
          actionState={actionState}
          moderationCase={moderationCase}
          onCancelRetry={() => {
            actionState.clearFeedback();
            void caseState.reload();
          }}
          onClaim={confirmClaim}
          onDecision={() =>
            router.push(
              `/moderator/cases/${encodeURIComponent(moderationCase.id)}/decision` as Href,
            )
          }
          onAudit={() =>
            router.push(
              `/moderator/cases/${encodeURIComponent(moderationCase.id)}/audits` as Href,
            )
          }
          onReasonAction={setReasonAction}
        />
      </ScrollView>

      <ModerationReasonDialog
        action={reasonAction}
        onClose={() => setReasonAction(null)}
        onSubmit={submitReason}
      />
    </Screen>
  );
}

function CaseLoadingState() {
  return (
    <Screen contentStyle={styles.centerState}>
      <ActivityIndicator color={palette.primary} size="large" />
      <Text accessibilityLiveRegion="polite" style={styles.stateText}>
        Loading moderation case…
      </Text>
    </Screen>
  );
}

function CaseUnavailableState({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <Screen contentStyle={styles.centerState}>
      <View style={styles.stateIcon}>
        <MaterialIcons name="find-in-page" size={34} color={palette.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        Case unavailable
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.stateText}>
        {message}
      </Text>
      <PrimaryButton label="Try again" onPress={onRetry} />
    </Screen>
  );
}

function WorkflowSection({ moderationCase }: { moderationCase: ModerationCaseDetail }) {
  return (
    <DetailSection title="Workflow context">
      <DetailRow label="Case state" value={MODERATION_CASE_STATE_LABELS[moderationCase.state]} />
      <DetailRow label="Priority" value={MODERATION_PRIORITY_LABELS[moderationCase.priority]} />
      <DetailRow
        label="Assignment"
        value={MODERATION_ASSIGNMENT_LABELS[moderationCase.assignment.state]}
      />
      <DetailRow
        label="Source"
        value={moderationCase.sources.map((source) => MODERATION_CASE_SOURCE_LABELS[source]).join(', ')}
      />
      <DetailRow label="Queued" value={formatDate(moderationCase.queuedAt)} />
      <DetailRow label="Review started" value={formatDate(moderationCase.reviewStartedAt)} />
      <DetailRow label="Resolved" value={formatDate(moderationCase.resolvedAt)} />
      <DetailRow label="Latest activity" value={formatDate(moderationCase.latestActivityAt)} />
      <DetailRow label="Case revision" value={moderationCase.caseRevision.toString()} />
      <DetailRow
        label="Lifecycle revision"
        value={moderationCase.incident.lifecycleRevision.toString()}
      />
      {moderationCase.resolution ? (
        <DetailRow
          label="Resolution"
          value={MODERATION_RESOLUTION_LABELS[moderationCase.resolution]}
        />
      ) : null}
      {moderationCase.resolutionReason ? (
        <DetailRow label="Resolution reason" value={moderationCase.resolutionReason} />
      ) : null}
    </DetailSection>
  );
}

function IncidentSection({ moderationCase }: { moderationCase: ModerationCaseDetail }) {
  const { incident } = moderationCase;
  return (
    <DetailSection title="Incident summary">
      <DetailRow label="Category" value={readableEnum(incident.category)} />
      <DetailRow label="Severity" value={readableEnum(incident.severity)} />
      <DetailRow label="Description" value={incident.description ?? 'No description provided'} />
      <DetailRow label="Submitted" value={formatDate(incident.createdAt)} />
      <DetailRow label="Occurred" value={formatDate(incident.occurredAt)} />
      <DetailRow
        label="Visibility"
        value={INCIDENT_VISIBILITY_LABELS[incident.visibilityState]}
      />
      <DetailRow
        label="Community state"
        value={INCIDENT_COMMUNITY_STATE_LABELS[incident.communityState]}
      />
      <DetailRow
        label="Moderation state"
        value={INCIDENT_MODERATION_STATE_LABELS[incident.moderationState]}
      />
    </DetailSection>
  );
}

function CommunityEvidenceSection({ moderationCase }: { moderationCase: ModerationCaseDetail }) {
  const { communityEvidence } = moderationCase;
  return (
    <DetailSection title="Community evidence">
      <Text style={styles.guidanceText}>
        Community evidence informs moderation review and does not determine incident validity by itself.
      </Text>
      <DetailRow
        label="Community state"
        value={INCIDENT_COMMUNITY_STATE_LABELS[communityEvidence.communityState]}
      />
      <DetailRow label="Support count" value={communityEvidence.supportCount.toString()} />
      <DetailRow
        label="Active feedback count"
        value={communityEvidence.activeFeedbackCount.toString()}
      />
      <DetailRow label="Evaluated" value={formatDate(communityEvidence.evaluatedAt)} />
    </DetailSection>
  );
}

function FlagSummarySection({ moderationCase }: { moderationCase: ModerationCaseDetail }) {
  const populatedReasons = INCIDENT_FLAG_REASONS.filter(
    (reason) => moderationCase.flags.byReason[reason] > 0,
  );

  return (
    <DetailSection title="Flag summary">
      <DetailRow label="Total flags" value={moderationCase.flags.total.toString()} />
      {populatedReasons.length > 0 ? (
        <View style={styles.reasonList}>
          {populatedReasons.map((reason) => (
            <ReasonCount
              key={reason}
              reason={reason}
              count={moderationCase.flags.byReason[reason]}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.mutedText}>No user flags are attached to this case.</Text>
      )}
    </DetailSection>
  );
}

function ActionPreparationSection({
  actionState,
  moderationCase,
  onCancelRetry,
  onClaim,
  onDecision,
  onAudit,
  onReasonAction,
}: {
  actionState: ModerationActionState;
  moderationCase: ModerationCaseDetail;
  onCancelRetry(): void;
  onClaim(): void;
  onDecision(): void;
  onAudit(): void;
  onReasonAction(action: ReasonAction): void;
}) {
  const actions = preparedActions(moderationCase);
  const actionsDisabled = actionState.submitting || actionState.retryAvailable;

  function selectAction(action: PreparedAction): void {
    if (action.action === 'CLAIM') {
      onClaim();
      return;
    }
    if (action.action === 'RELEASE' || action.action === 'REOPEN') {
      onReasonAction(action.action);
      return;
    }
    onDecision();
  }

  return (
    <DetailSection title="Available actions">
      <Text style={styles.guidanceText}>
        Workflow actions use the case revisions currently shown and are protected against concurrent changes.
      </Text>
      {actionState.successMessage ? (
        <View accessibilityLiveRegion="polite" style={styles.actionSuccess}>
          <MaterialIcons name="check-circle" size={20} color={palette.primary} />
          <Text style={styles.actionSuccessText}>{actionState.successMessage}</Text>
        </View>
      ) : null}
      {actionState.error ? (
        <View accessibilityLiveRegion="assertive" style={styles.actionError}>
          <MaterialIcons name="error-outline" size={20} color={palette.error} />
          <Text style={styles.actionErrorText}>{actionState.error}</Text>
        </View>
      ) : null}
      {actionState.retryAvailable ? (
        <View style={styles.actions}>
          <PrimaryButton
            label="Retry exact action"
            loading={actionState.submitting}
            onPress={() => void actionState.retry()}
          />
          <PrimaryButton
            disabled={actionState.submitting}
            label="Cancel retry and refresh"
            variant="secondary"
            onPress={onCancelRetry}
          />
        </View>
      ) : null}
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <PrimaryButton
              key={action.action}
              disabled={actionsDisabled}
              label={action.label}
              loading={actionState.submittingAction === action.action}
              variant={action.variant}
              onPress={() => selectAction(action)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.mutedText}>
          No actions are available for your current assignment and case state.
        </Text>
      )}
      <PrimaryButton
        disabled={actionsDisabled}
        label="View audit history"
        variant="secondary"
        onPress={onAudit}
      />
    </DetailSection>
  );
}

function DetailSection({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ReasonCount({ reason, count }: { reason: IncidentFlagReason; count: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${INCIDENT_FLAG_REASON_LABELS[reason]}: ${count}`}
      style={styles.reasonRow}>
      <Text style={styles.reasonLabel}>{INCIDENT_FLAG_REASON_LABELS[reason]}</Text>
      <Text style={styles.reasonCount}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: palette.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.error,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  inlineErrorText: { flex: 1, color: palette.error, fontSize: 14, lineHeight: 20 },
  section: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  sectionTitle: { color: palette.text, fontSize: 19, lineHeight: 25, fontWeight: '900' },
  sectionBody: { gap: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  detailLabel: { flex: 1, color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  detailValue: {
    flex: 1.4,
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
  guidanceText: {
    padding: spacing.md,
    borderRadius: radius.sm,
    color: palette.text,
    backgroundColor: palette.surfaceMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  reasonList: { gap: spacing.sm },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reasonLabel: { flex: 1, color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  reasonCount: { color: palette.text, fontSize: 14, fontWeight: '800' },
  mutedText: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
  actionSuccess: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceMuted,
  },
  actionSuccessText: { flex: 1, color: palette.text, fontSize: 14, lineHeight: 20 },
  actionError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.error,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
  },
  actionErrorText: { flex: 1, color: palette.error, fontSize: 14, lineHeight: 20 },
  actions: { gap: spacing.sm },
  centerState: {
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
