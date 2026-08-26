import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/features/auth/auth-provider';
import { palette, radius, spacing } from '@/src/theme';

import {
  useModerationAction,
  type ModerationActionState,
} from '../hooks/use-moderation-action';
import { useModerationCase } from '../hooks/use-moderation-case';
import { MODERATION_DECISION_ACTION_LABELS } from '../moderation-labels';
import type {
  IncidentVisibilityState,
  ModerationCaseDetail,
  ModerationDecisionAction,
} from '../moderation.types';

const OBJECT_ID = /^[0-9a-f]{24}$/;

const DECISION_COPY = {
  NO_ACTION: {
    description: 'Resolve the review without changing public visibility.',
    confirmation: 'The incident keeps its current public visibility when this case is resolved.',
  },
  HIDE: {
    description: 'Remove this incident from public map and reader results.',
    confirmation: 'Hiding removes this incident from public visibility and public readers.',
  },
  RESTORE: {
    description: 'Return this incident to public map and reader results.',
    confirmation: 'Restoring makes this incident public again through privacy-safe public readers.',
  },
  ARCHIVE: {
    description: 'Archive this incident and remove it from public readers.',
    confirmation: 'Archiving removes this incident from public readers and marks it archived.',
  },
  ARCHIVE_DUPLICATE: {
    description: 'Archive this incident as a duplicate of another report.',
    confirmation: 'Duplicate archive removes this incident from public readers and records the related incident.',
  },
} as const satisfies Record<ModerationDecisionAction, {
  description: string;
  confirmation: string;
}>;

interface ModerationDecisionScreenProps {
  caseId: string | null;
}

type DecisionStage = 'REVIEW' | 'CONFIRM';
type DecisionErrors = {
  action?: string;
  reason?: string;
  relatedIncidentId?: string;
};

function availableActions(visibility: IncidentVisibilityState): ModerationDecisionAction[] {
  if (visibility === 'PUBLIC') {
    return ['NO_ACTION', 'HIDE', 'ARCHIVE', 'ARCHIVE_DUPLICATE'];
  }
  if (visibility === 'HIDDEN') {
    return ['NO_ACTION', 'RESTORE', 'ARCHIVE', 'ARCHIVE_DUPLICATE'];
  }
  return ['NO_ACTION', 'RESTORE'];
}

function eligibilityMessage(moderationCase: ModerationCaseDetail): string | null {
  if (moderationCase.state !== 'IN_REVIEW') {
    return 'This case is no longer in active review. Return to the case and review its latest state.';
  }
  if (moderationCase.assignment.state !== 'ASSIGNED_TO_ME') {
    return 'Only the moderator currently assigned to this case can record a decision.';
  }
  return null;
}

export function ModerationDecisionScreen({ caseId }: ModerationDecisionScreenProps) {
  const router = useRouter();
  const { accessToken, retry: retrySession, status } = useAuth();
  const caseState = useModerationCase(accessToken, caseId);
  const actionState = useModerationAction(accessToken, {
    refreshCase: caseState.reload,
    recoverSession: retrySession,
  });
  const [stage, setStage] = useState<DecisionStage>('REVIEW');
  const [decision, setDecision] = useState<ModerationDecisionAction | null>(null);
  const [reason, setReason] = useState('');
  const [relatedIncidentId, setRelatedIncidentId] = useState('');
  const [errors, setErrors] = useState<DecisionErrors>({});

  const moderationCase = caseState.moderationCase;
  const visibility = moderationCase?.incident.visibilityState;

  useEffect(() => {
    if (!actionState.reviewRequired) return;
    setStage('REVIEW');
    setDecision(null);
    setReason('');
    setRelatedIncidentId('');
    setErrors({});
  }, [actionState.reviewRequired]);

  useEffect(() => {
    if (!decision || !visibility || availableActions(visibility).includes(decision)) return;
    setDecision(null);
    setRelatedIncidentId('');
    setStage('REVIEW');
  }, [decision, visibility]);

  function returnToCase(): void {
    if (!caseId) {
      router.back();
      return;
    }
    router.replace(`/moderator/cases/${encodeURIComponent(caseId)}` as Href);
  }

  if (actionState.successMessage) {
    return (
      <DecisionSuccess message={actionState.successMessage} onReturnToCase={returnToCase} />
    );
  }

  if (status === 'loading' || (status === 'ready' && caseState.loading)) {
    return <DecisionLoading />;
  }

  if (status === 'error') {
    return (
      <DecisionUnavailable
        message="Your session could not be restored. Recover it before recording a decision."
        retryLabel="Recover session"
        onRetry={() => void retrySession()}
        onReturnToCase={returnToCase}
      />
    );
  }

  if (!moderationCase) {
    return (
      <DecisionUnavailable
        message={caseState.error ?? 'This moderation case is unavailable.'}
        retryLabel={caseState.errorStatus === 401 ? 'Recover session' : 'Try again'}
        onRetry={() =>
          void (caseState.errorStatus === 401 ? retrySession() : caseState.reload())
        }
        onReturnToCase={returnToCase}
      />
    );
  }

  const eligibilityError = eligibilityMessage(moderationCase);
  if (eligibilityError) {
    return (
      <DecisionUnavailable
        message={actionState.error ?? eligibilityError}
        onReturnToCase={returnToCase}
      />
    );
  }

  const activeCase = moderationCase;
  const actions = availableActions(activeCase.incident.visibilityState);

  function reviewDecision(): void {
    const nextErrors: DecisionErrors = {};
    const normalizedReason = reason.trim();
    const normalizedRelatedId = relatedIncidentId.trim().toLowerCase();

    if (!decision || !actions.includes(decision)) {
      nextErrors.action = 'Choose an available moderation decision.';
    }
    if (normalizedReason.length < 1 || normalizedReason.length > 1000) {
      nextErrors.reason = 'Enter a reason between 1 and 1000 characters.';
    }
    if (decision === 'ARCHIVE_DUPLICATE') {
      if (!OBJECT_ID.test(normalizedRelatedId)) {
        nextErrors.relatedIncidentId = 'Enter a valid 24-character incident ID.';
      } else if (normalizedRelatedId === activeCase.incident.id.toLowerCase()) {
        nextErrors.relatedIncidentId = 'Choose a different incident as the duplicate source.';
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      AccessibilityInfo.announceForAccessibility(
        nextErrors.action ??
          nextErrors.reason ??
          nextErrors.relatedIncidentId ??
          'Review the decision details.',
      );
      return;
    }

    setReason(normalizedReason);
    setRelatedIncidentId(decision === 'ARCHIVE_DUPLICATE' ? normalizedRelatedId : '');
    actionState.clearFeedback();
    setStage('CONFIRM');
  }

  function submitDecision(): void {
    if (!decision) return;
    void actionState.submitDecision(activeCase, {
      action: decision,
      reason,
      ...(decision === 'ARCHIVE_DUPLICATE' ? { relatedIncidentId } : {}),
    });
  }

  function cancelRetry(): void {
    actionState.clearFeedback();
    setStage('REVIEW');
    setDecision(null);
    setReason('');
    setRelatedIncidentId('');
    setErrors({});
    void caseState.reload();
  }

  return (
    <Screen keyboardAvoiding contentStyle={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            enabled={stage === 'REVIEW' && !actionState.submitting}
            refreshing={caseState.refreshing}
            tintColor={palette.primary}
            onRefresh={() => {
              if (stage === 'REVIEW') void caseState.refresh();
            }}
          />
        }>
        <DecisionHeader stage={stage} />

        {stage === 'REVIEW' && (actionState.error ?? caseState.error) ? (
          <View accessibilityLiveRegion="assertive" style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={20} color={palette.error} />
            <Text style={styles.errorCardText}>{actionState.error ?? caseState.error}</Text>
          </View>
        ) : null}

        {stage === 'REVIEW' ? (
          <DecisionForm
            actions={actions}
            decision={decision}
            errors={errors}
            incidentId={moderationCase.incident.id}
            reason={reason}
            relatedIncidentId={relatedIncidentId}
            visibility={moderationCase.incident.visibilityState}
            onDecisionChange={(nextDecision) => {
              setDecision(nextDecision);
              setErrors({});
              if (nextDecision !== 'ARCHIVE_DUPLICATE') setRelatedIncidentId('');
            }}
            onReasonChange={(value) => {
              setReason(value);
              setErrors((current) => ({ ...current, reason: undefined }));
            }}
            onRelatedIncidentIdChange={(value) => {
              setRelatedIncidentId(value.toLowerCase());
              setErrors((current) => ({ ...current, relatedIncidentId: undefined }));
            }}
            onReview={reviewDecision}
          />
        ) : decision ? (
          <DecisionConfirmation
            actionState={actionState}
            decision={decision}
            reason={reason}
            relatedIncidentId={relatedIncidentId}
            onBack={() => {
              actionState.clearFeedback();
              setStage('REVIEW');
            }}
            onCancelRetry={cancelRetry}
            onConfirm={submitDecision}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function DecisionHeader({ stage }: { stage: DecisionStage }) {
  const step = stage === 'REVIEW' ? 1 : 2;
  return (
    <View style={styles.header}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: 2, now: step, text: `Step ${step} of 2` }}>
        <Text style={styles.eyebrow}>STEP {step} OF 2</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {stage === 'REVIEW' ? 'Review decision' : 'Confirm decision'}
      </Text>
      <Text style={styles.subtitle}>
        {stage === 'REVIEW'
          ? 'Choose an available outcome and record a clear moderation reason.'
          : 'Check the visibility impact carefully before recording this decision.'}
      </Text>
    </View>
  );
}

function DecisionForm({
  actions,
  decision,
  errors,
  incidentId,
  reason,
  relatedIncidentId,
  visibility,
  onDecisionChange,
  onReasonChange,
  onRelatedIncidentIdChange,
  onReview,
}: {
  actions: ModerationDecisionAction[];
  decision: ModerationDecisionAction | null;
  errors: DecisionErrors;
  incidentId: string;
  reason: string;
  relatedIncidentId: string;
  visibility: IncidentVisibilityState;
  onDecisionChange(action: ModerationDecisionAction): void;
  onReasonChange(value: string): void;
  onRelatedIncidentIdChange(value: string): void;
  onReview(): void;
}) {
  return (
    <View style={styles.form}>
      <View style={styles.contextCard}>
        <Text style={styles.contextLabel}>Current visibility</Text>
        <Text style={styles.contextValue}>{visibility.charAt(0) + visibility.slice(1).toLowerCase()}</Text>
        <Text style={styles.contextDetail}>Incident ID: {incidentId}</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Decision</Text>
        <View style={styles.options}>
          {actions.map((action) => {
            const selected = decision === action;
            return (
              <Pressable
                key={action}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onDecisionChange(action)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.optionHeading}>
                  <MaterialIcons
                    name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={21}
                    color={selected ? palette.primary : palette.textMuted}
                  />
                  <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                    {MODERATION_DECISION_ACTION_LABELS[action]}
                  </Text>
                </View>
                <Text style={styles.optionDescription}>{DECISION_COPY[action].description}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.action ? <FieldError message={errors.action} /> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Reason</Text>
        <TextInput
          accessibilityLabel="Moderation decision reason"
          maxLength={1000}
          multiline
          onChangeText={onReasonChange}
          placeholder="Explain the evidence and reasoning for this decision"
          placeholderTextColor={palette.textMuted}
          style={[styles.reasonInput, errors.reason && styles.inputError]}
          textAlignVertical="top"
          value={reason}
        />
        <View style={styles.fieldFooter}>
          {errors.reason ? <FieldError message={errors.reason} /> : <View />}
          <Text style={styles.characterCount}>{reason.length}/1000</Text>
        </View>
      </View>

      {decision === 'ARCHIVE_DUPLICATE' ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Related incident ID</Text>
          <Text style={styles.helperText}>
            Enter the 24-character ID for the existing incident this report duplicates.
          </Text>
          <TextInput
            accessibilityLabel="Related incident ID"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={64}
            onChangeText={onRelatedIncidentIdChange}
            placeholder="0123456789abcdef01234567"
            placeholderTextColor={palette.textMuted}
            style={[styles.idInput, errors.relatedIncidentId && styles.inputError]}
            value={relatedIncidentId}
          />
          {errors.relatedIncidentId ? <FieldError message={errors.relatedIncidentId} /> : null}
        </View>
      ) : null}

      <PrimaryButton label="Review decision" onPress={onReview} />
    </View>
  );
}

function DecisionConfirmation({
  actionState,
  decision,
  reason,
  relatedIncidentId,
  onBack,
  onCancelRetry,
  onConfirm,
}: {
  actionState: ModerationActionState;
  decision: ModerationDecisionAction;
  reason: string;
  relatedIncidentId: string;
  onBack(): void;
  onCancelRetry(): void;
  onConfirm(): void;
}) {
  return (
    <View style={styles.form}>
      <View style={styles.confirmationCard}>
        <Text style={styles.confirmationLabel}>Decision</Text>
        <Text style={styles.confirmationTitle}>{MODERATION_DECISION_ACTION_LABELS[decision]}</Text>
        <Text style={styles.confirmationImpact}>{DECISION_COPY[decision].confirmation}</Text>
      </View>
      <ReviewRow label="Reason" value={reason} />
      {decision === 'ARCHIVE_DUPLICATE' ? (
        <ReviewRow label="Related incident ID" value={relatedIncidentId} />
      ) : null}

      {actionState.error ? (
        <View accessibilityLiveRegion="assertive" style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={20} color={palette.error} />
          <Text style={styles.errorCardText}>{actionState.error}</Text>
        </View>
      ) : null}

      {actionState.retryAvailable ? (
        <View style={styles.actions}>
          <PrimaryButton
            label="Retry exact decision"
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
      ) : (
        <View style={styles.actions}>
          <PrimaryButton
            label="Confirm decision"
            loading={actionState.submittingAction === 'DECISION'}
            onPress={onConfirm}
          />
          <PrimaryButton
            disabled={actionState.submitting}
            label="Back to edit"
            variant="secondary"
            onPress={onBack}
          />
        </View>
      )}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{message}</Text>;
}

function DecisionLoading() {
  return (
    <Screen contentStyle={styles.centerState}>
      <ActivityIndicator color={palette.primary} size="large" />
      <Text accessibilityLiveRegion="polite" style={styles.stateText}>Loading fresh case details…</Text>
    </Screen>
  );
}

function DecisionUnavailable({
  message,
  retryLabel,
  onRetry,
  onReturnToCase,
}: {
  message: string;
  retryLabel?: string;
  onRetry?(): void;
  onReturnToCase(): void;
}) {
  return (
    <Screen contentStyle={styles.centerState}>
      <View style={styles.stateIcon}>
        <MaterialIcons name="gpp-bad" size={34} color={palette.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>Decision unavailable</Text>
      <Text accessibilityLiveRegion="polite" style={styles.stateText}>{message}</Text>
      {onRetry ? <PrimaryButton label={retryLabel ?? 'Try again'} onPress={onRetry} /> : null}
      <PrimaryButton label="Return to case" variant="secondary" onPress={onReturnToCase} />
    </Screen>
  );
}

function DecisionSuccess({ message, onReturnToCase }: { message: string; onReturnToCase(): void }) {
  return (
    <Screen contentStyle={styles.centerState}>
      <View style={styles.stateIcon}>
        <MaterialIcons name="check-circle" size={38} color={palette.primary} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>Decision recorded</Text>
      <Text accessibilityLiveRegion="polite" style={styles.stateText}>{message}</Text>
      <PrimaryButton label="Return to case" onPress={onReturnToCase} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: palette.text, fontSize: 29, lineHeight: 35, fontWeight: '900' },
  subtitle: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  form: { gap: spacing.lg },
  contextCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  contextLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  contextValue: { color: palette.text, fontSize: 18, fontWeight: '900' },
  contextDetail: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
  fieldGroup: { gap: spacing.sm },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  label: { color: palette.text, fontSize: 16, fontWeight: '800' },
  helperText: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
  options: { gap: spacing.sm },
  option: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  optionSelected: { borderWidth: 2, borderColor: palette.primary, backgroundColor: palette.surfaceMuted },
  optionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionTitle: { flex: 1, color: palette.text, fontSize: 16, fontWeight: '800' },
  optionTitleSelected: { color: palette.primary },
  optionDescription: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.75 },
  reasonInput: {
    minHeight: 150,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    color: palette.text,
    backgroundColor: palette.surface,
    fontSize: 16,
    lineHeight: 23,
  },
  idInput: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    color: palette.text,
    backgroundColor: palette.surface,
    fontSize: 15,
  },
  inputError: { borderColor: palette.error },
  fieldFooter: { minHeight: 20, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  characterCount: { color: palette.textMuted, fontSize: 13 },
  fieldError: { flex: 1, color: palette.error, fontSize: 13, lineHeight: 19 },
  confirmationCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  confirmationLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  confirmationTitle: { color: palette.text, fontSize: 21, fontWeight: '900' },
  confirmationImpact: { color: palette.text, fontSize: 15, lineHeight: 22 },
  reviewRow: {
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  reviewLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  reviewValue: { color: palette.text, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.error,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  errorCardText: { flex: 1, color: palette.error, fontSize: 14, lineHeight: 20 },
  actions: { gap: spacing.sm },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: palette.surfaceMuted,
  },
  stateTitle: { color: palette.text, fontSize: 23, fontWeight: '900', textAlign: 'center' },
  stateText: { color: palette.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
