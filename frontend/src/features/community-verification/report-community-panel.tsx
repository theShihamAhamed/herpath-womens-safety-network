import * as Crypto from 'expo-crypto';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/src/features/auth/auth-provider';
import { ApiError, messageFromError } from '@/src/services/api/errors';
import { palette, radius, spacing } from '@/src/theme';

import { communityVerificationApi } from './community-verification-api';
import {
  FEEDBACK_RESPONSES,
  INCIDENT_FLAG_REASONS,
  type CommunityIncidentChange,
  type CommunityVerificationStatus,
  type FeedbackEligibility,
  type FeedbackResponse,
  type IncidentFlagReason,
} from './community-verification.types';

const FEEDBACK_LABELS: Record<FeedbackResponse, string> = {
  SUPPORT: 'I support this report',
  RESOLVED: 'This may be resolved',
  DISPUTE: 'I dispute this report',
  UNSURE: 'I am unsure',
};

const FLAG_LABELS: Record<IncidentFlagReason, string> = {
  INACCURATE: 'Inaccurate',
  SPAM: 'Spam',
  DUPLICATE: 'Duplicate',
  HARMFUL_CONTENT: 'Harmful content',
  PRIVACY_VIOLATION: 'Privacy violation',
  MISLEADING: 'Misleading',
  OTHER: 'Other',
};

const COMMUNITY_STATE_LABELS: Record<CommunityVerificationStatus['evidence']['communityState'], string> = {
  UNVERIFIED: 'No clear community pattern yet',
  SUPPORTED: 'Community support is established',
  CONFLICTED: 'Community responses are mixed',
  LIKELY_RESOLVED: 'Community responses suggest this may be resolved',
};

interface MutationIntent<T> {
  id: string;
  value: T;
}

interface FlagIntentValue {
  reason: IncidentFlagReason;
  details: string;
}

interface ReportCommunityPanelProps {
  incidentId: string;
  onIncidentChanged?: (change: CommunityIncidentChange) => void;
}

function isIncidentUnavailable(error: unknown): boolean {
  return error instanceof ApiError &&
    (error.status === 404 || error.code === 'INCIDENT_NOT_AVAILABLE');
}

function feedbackBlockedMessage(eligibility: FeedbackEligibility): string | null {
  if (eligibility.reason === 'OWN_REPORT') {
    return 'You cannot add community feedback or flag your own report.';
  }
  if (eligibility.reason === 'COOLDOWN_ACTIVE') {
    const next = eligibility.nextEligibleAt
      ? new Date(eligibility.nextEligibleAt).toLocaleString()
      : 'later';
    return `You can change or remove your response after ${next}.`;
  }
  if (eligibility.reason === 'INCIDENT_NOT_FOUND' || eligibility.reason === 'INCIDENT_NOT_PUBLIC') {
    return 'This report is no longer available for community feedback.';
  }
  if (eligibility.reason === 'AUTHENTICATION_REQUIRED') {
    return 'A HerPath session is required for community feedback.';
  }
  return null;
}

export function ReportCommunityPanel({
  incidentId,
  onIncidentChanged,
}: ReportCommunityPanelProps) {
  const { accessToken, status: authStatus } = useAuth();
  const [status, setStatus] = useState<CommunityVerificationStatus | null>(null);
  const [eligibility, setEligibility] = useState<FeedbackEligibility | null>(null);
  const [eligibilityRefreshing, setEligibilityRefreshing] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error' | 'unavailable'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState<IncidentFlagReason | null>(null);
  const [flagDetails, setFlagDetails] = useState('');
  const [flagPending, setFlagPending] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagCanRetry, setFlagCanRetry] = useState(false);
  const [alreadyFlagged, setAlreadyFlagged] = useState(false);
  const feedbackIntentRef = useRef<MutationIntent<FeedbackResponse> | null>(null);
  const flagIntentRef = useRef<MutationIntent<FlagIntentValue> | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (authStatus !== 'ready' || !accessToken) {
      setLoadState(authStatus === 'error' ? 'error' : 'loading');
      if (authStatus === 'error') setLoadError('A HerPath session is required for community actions.');
      return;
    }

    setLoadState('loading');
    setLoadError(null);
    try {
      const [nextStatus, nextEligibility] = await Promise.all([
        communityVerificationApi.status(accessToken, incidentId, signal),
        communityVerificationApi.eligibility(accessToken, incidentId, signal),
      ]);
      if (signal?.aborted) return;
      if (
        nextEligibility.reason === 'INCIDENT_NOT_FOUND' ||
        nextEligibility.reason === 'INCIDENT_NOT_PUBLIC'
      ) {
        setLoadState('unavailable');
        return;
      }
      setStatus(nextStatus);
      setEligibility(nextEligibility);
      setLoadState('loaded');
    } catch (error) {
      if (signal?.aborted) return;
      if (isIncidentUnavailable(error)) {
        setLoadState('unavailable');
        return;
      }
      setLoadError(messageFromError(error));
      setLoadState('error');
    }
  }, [accessToken, authStatus, incidentId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const refreshEligibility = async () => {
    if (!accessToken) return;
    setEligibilityRefreshing(true);
    setEligibilityError(null);
    try {
      setEligibility(await communityVerificationApi.eligibility(accessToken, incidentId));
    } catch (error) {
      setEligibilityError(messageFromError(error));
    } finally {
      setEligibilityRefreshing(false);
    }
  };

  const acceptStatus = (nextStatus: CommunityVerificationStatus) => {
    setStatus(nextStatus);
    onIncidentChanged?.({ incidentId, evidence: nextStatus.evidence });
    void refreshEligibility();
  };

  const submitFeedback = async (response: FeedbackResponse) => {
    if (!accessToken || feedbackPending || eligibility?.canSubmit !== true) return;
    let intent = feedbackIntentRef.current;
    if (!intent || intent.value !== response) {
      intent = { id: Crypto.randomUUID(), value: response };
      feedbackIntentRef.current = intent;
    }

    setFeedbackPending(true);
    setFeedbackError(null);
    setRemoveError(null);
    try {
      const nextStatus = await communityVerificationApi.submitFeedback(accessToken, incidentId, {
        clientFeedbackId: intent.id,
        response: intent.value,
      });
      feedbackIntentRef.current = null;
      acceptStatus(nextStatus);
    } catch (error) {
      setFeedbackError(messageFromError(error));
    } finally {
      setFeedbackPending(false);
    }
  };

  const removeFeedback = async () => {
    if (!accessToken || feedbackPending || eligibility?.canSubmit !== true) return;
    setFeedbackPending(true);
    setRemoveError(null);
    setFeedbackError(null);
    try {
      const nextStatus = await communityVerificationApi.removeFeedback(accessToken, incidentId);
      acceptStatus(nextStatus);
    } catch (error) {
      setRemoveError(messageFromError(error));
    } finally {
      setFeedbackPending(false);
    }
  };

  const confirmRemoveFeedback = () => {
    Alert.alert(
      'Remove community response?',
      'Your response will remain visible until HerPath confirms removal.',
      [
        { text: 'Keep response', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void removeFeedback() },
      ],
    );
  };

  const submitFlag = async () => {
    if (!accessToken || flagPending || alreadyFlagged) return;
    if (!flagReason) {
      setFlagCanRetry(false);
      setFlagError('Choose a reason before submitting this report.');
      return;
    }
    const details = flagDetails.trim();
    if (details.length > 500) {
      setFlagCanRetry(false);
      setFlagError('Additional details must contain at most 500 characters.');
      return;
    }

    const value = { reason: flagReason, details };
    let intent = flagIntentRef.current;
    if (
      !intent ||
      intent.value.reason !== value.reason ||
      intent.value.details !== value.details
    ) {
      intent = { id: Crypto.randomUUID(), value };
      flagIntentRef.current = intent;
    }

    setFlagPending(true);
    setFlagCanRetry(false);
    setFlagError(null);
    try {
      await communityVerificationApi.submitFlag(accessToken, incidentId, {
        clientFlagId: intent.id,
        reason: intent.value.reason,
        ...(intent.value.details ? { details: intent.value.details } : {}),
      });
      flagIntentRef.current = null;
      setFlagCanRetry(false);
      setAlreadyFlagged(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'FLAG_ALREADY_SUBMITTED') {
        flagIntentRef.current = null;
        setFlagCanRetry(false);
        setAlreadyFlagged(true);
      } else {
        setFlagCanRetry(true);
        setFlagError(messageFromError(error));
      }
    } finally {
      setFlagPending(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.centeredState}>
        <ActivityIndicator accessibilityLabel="Loading community evidence" color={palette.primary} />
        <Text style={styles.muted}>Loading community evidence…</Text>
      </View>
    );
  }

  if (loadState === 'unavailable') {
    return (
      <View accessibilityRole="alert" style={styles.notice}>
        <Text style={styles.noticeTitle}>Report unavailable</Text>
        <Text style={styles.muted}>This report is no longer available for community actions.</Text>
      </View>
    );
  }

  if (loadState === 'error' || !status || !eligibility) {
    return (
      <View accessibilityRole="alert" style={styles.notice}>
        <Text style={styles.noticeTitle}>Community information unavailable</Text>
        <Text style={styles.muted}>{loadError ?? 'Community information could not be loaded.'}</Text>
        <Pressable
          accessibilityLabel="Retry community information"
          accessibilityRole="button"
          onPress={() => void load()}
          style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const blockedMessage = feedbackBlockedMessage(eligibility);
  const ownReport = eligibility.reason === 'OWN_REPORT';
  const currentResponse = status.myFeedback?.response ?? null;

  return (
    <View style={styles.panel}>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Community evidence</Text>
        <Text style={styles.evidenceState}>{COMMUNITY_STATE_LABELS[status.evidence.communityState]}</Text>
        <Text style={styles.muted}>
          {status.evidence.supportCount} community {status.evidence.supportCount === 1 ? 'support' : 'supports'}
        </Text>
        <Text style={styles.muted}>
          {status.evidence.activeFeedbackCount} active community {status.evidence.activeFeedbackCount === 1 ? 'response' : 'responses'}
        </Text>
        {currentResponse ? (
          <Text style={styles.currentResponse}>Your response: {FEEDBACK_LABELS[currentResponse]}</Text>
        ) : (
          <Text style={styles.muted}>You have not responded to this report.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your community response</Text>
        {blockedMessage ? (
          <Text accessibilityRole="alert" style={styles.blockedText}>{blockedMessage}</Text>
        ) : null}
        {eligibilityError ? (
          <View accessibilityRole="alert" style={styles.notice}>
            <Text style={styles.errorText}>Eligibility could not be refreshed: {eligibilityError}</Text>
            <Pressable
              accessibilityLabel="Retry feedback eligibility"
              accessibilityRole="button"
              onPress={() => void refreshEligibility()}
              style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>Retry eligibility</Text>
            </Pressable>
          </View>
        ) : null}
        {eligibilityRefreshing ? (
          <Text accessibilityLiveRegion="polite" style={styles.muted}>Refreshing eligibility…</Text>
        ) : null}
        <View accessibilityRole="radiogroup" style={styles.choiceList}>
          {FEEDBACK_RESPONSES.map((response) => {
            const selected = currentResponse === response;
            const disabled = feedbackPending || eligibilityRefreshing || eligibility.canSubmit !== true || selected;
            return (
              <Pressable
                key={response}
                accessibilityLabel={FEEDBACK_LABELS[response]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() => void submitFeedback(response)}
                style={[styles.choice, selected && styles.choiceSelected, disabled && styles.disabled]}>
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                  {FEEDBACK_LABELS[response]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {feedbackPending ? <Text accessibilityLiveRegion="polite" style={styles.muted}>Saving response…</Text> : null}
        {feedbackError ? (
          <View accessibilityRole="alert" style={styles.notice}>
            <Text style={styles.errorText}>{feedbackError}</Text>
            {feedbackError ? (
              <Pressable
                accessibilityLabel="Retry community response"
                accessibilityRole="button"
                onPress={() => {
                  const intent = feedbackIntentRef.current;
                  if (intent) void submitFeedback(intent.value);
                }}
                style={styles.outlineButton}>
                <Text style={styles.outlineButtonText}>Retry response</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {status.myFeedback ? (
          <Pressable
            accessibilityLabel="Remove community response"
            accessibilityRole="button"
            accessibilityState={{ disabled: feedbackPending || eligibilityRefreshing || eligibility.canSubmit !== true }}
            disabled={feedbackPending || eligibilityRefreshing || eligibility.canSubmit !== true}
            onPress={confirmRemoveFeedback}
            style={[styles.removeButton, (feedbackPending || eligibilityRefreshing || eligibility.canSubmit !== true) && styles.disabled]}>
            <Text style={styles.removeText}>Remove my response</Text>
          </Pressable>
        ) : null}
        {removeError ? <Text accessibilityRole="alert" style={styles.errorText}>{removeError}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Report this incident</Text>
        {ownReport ? (
          <Text style={styles.blockedText}>You cannot flag your own report.</Text>
        ) : alreadyFlagged ? (
          <Text accessibilityRole="alert" style={styles.successText}>You have already reported this incident for review.</Text>
        ) : (
          <>
            <Text style={styles.visibleLabel}>Reason</Text>
            <View accessibilityRole="radiogroup" style={styles.choiceList}>
              {INCIDENT_FLAG_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  accessibilityLabel={`Flag reason: ${FLAG_LABELS[reason]}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: flagReason === reason, disabled: flagPending }}
                  disabled={flagPending}
                  onPress={() => {
                    setFlagReason(reason);
                    setFlagError(null);
                    setFlagCanRetry(false);
                    flagIntentRef.current = null;
                  }}
                  style={[styles.choice, flagReason === reason && styles.choiceSelected, flagPending && styles.disabled]}>
                  <Text style={[styles.choiceText, flagReason === reason && styles.choiceTextSelected]}>
                    {FLAG_LABELS[reason]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.visibleLabel}>Additional details (optional)</Text>
            <TextInput
              accessibilityLabel="Flag additional details"
              editable={!flagPending}
              maxLength={500}
              multiline
              onChangeText={(value) => {
                setFlagDetails(value);
                setFlagError(null);
                setFlagCanRetry(false);
                flagIntentRef.current = null;
              }}
              placeholder="Add context for the moderation team"
              style={styles.detailsInput}
              value={flagDetails}
            />
            <Text style={styles.characterCount}>{flagDetails.length}/500</Text>
            {flagError ? <Text accessibilityRole="alert" style={styles.errorText}>{flagError}</Text> : null}
            <Pressable
              accessibilityLabel={flagCanRetry ? 'Retry incident report' : 'Submit incident report'}
              accessibilityRole="button"
              accessibilityState={{ busy: flagPending, disabled: flagPending }}
              disabled={flagPending}
              onPress={() => void submitFlag()}
              style={[styles.primaryButton, flagPending && styles.disabled]}>
              <Text style={styles.primaryButtonText}>{flagPending ? 'Submitting…' : flagCanRetry ? 'Retry report' : 'Submit report'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingTop: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  evidenceState: { color: palette.primary, fontSize: 13, fontWeight: '700' },
  muted: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  currentResponse: { color: palette.text, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  blockedText: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  centeredState: { minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  notice: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: palette.surfaceMuted },
  noticeTitle: { color: palette.text, fontSize: 13, fontWeight: '800' },
  choiceList: { gap: spacing.sm },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, backgroundColor: palette.surface },
  choiceSelected: { borderColor: palette.primary, backgroundColor: palette.surfaceMuted },
  choiceText: { color: palette.text, fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: palette.primary, fontWeight: '800' },
  outlineButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm },
  outlineButtonText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  removeButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  removeText: { color: palette.error, fontSize: 13, fontWeight: '800' },
  errorText: { color: palette.error, fontSize: 12, lineHeight: 17 },
  successText: { color: palette.primary, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  visibleLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },
  detailsInput: { minHeight: 88, padding: 12, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, backgroundColor: palette.surface, color: palette.text, textAlignVertical: 'top' },
  characterCount: { alignSelf: 'flex-end', color: palette.textMuted, fontSize: 11 },
  primaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: palette.primary },
  primaryButtonText: { color: palette.white, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
