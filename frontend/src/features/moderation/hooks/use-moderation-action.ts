import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/src/services/api/errors';

import { moderationApi } from '../moderation-api';
import type {
  ClaimModerationCaseInput,
  DecideModerationCaseInput,
  ModerationCaseDetail,
  ModerationDecisionAction,
  ReasonedModerationCaseInput,
} from '../moderation.types';

export type ModerationWorkflowAction = 'CLAIM' | 'RELEASE' | 'REOPEN';
export type ModerationSubmissionAction = ModerationWorkflowAction | 'DECISION';

export interface ModerationDecisionIntent {
  action: ModerationDecisionAction;
  reason: string;
  relatedIncidentId?: string;
}

type ActionIntent =
  | {
      readonly action: 'CLAIM';
      readonly caseId: string;
      readonly input: Readonly<ClaimModerationCaseInput>;
    }
  | {
      readonly action: 'RELEASE';
      readonly caseId: string;
      readonly input: Readonly<ReasonedModerationCaseInput>;
    }
  | {
      readonly action: 'REOPEN';
      readonly caseId: string;
      readonly input: Readonly<ReasonedModerationCaseInput>;
    }
  | {
      readonly action: 'DECISION';
      readonly caseId: string;
      readonly input: Readonly<DecideModerationCaseInput>;
    };

interface ModerationActionDependencies {
  refreshCase(): Promise<void>;
  recoverSession(): Promise<void>;
}

export interface ModerationActionState {
  submitting: boolean;
  submittingAction: ModerationSubmissionAction | null;
  error: string | null;
  successMessage: string | null;
  retryAvailable: boolean;
  reviewRequired: boolean;
  submit(
    action: ModerationWorkflowAction,
    moderationCase: ModerationCaseDetail,
    reason?: string,
  ): Promise<void>;
  submitDecision(
    moderationCase: ModerationCaseDetail,
    decision: ModerationDecisionIntent,
  ): Promise<void>;
  retry(): Promise<void>;
  clearFeedback(): void;
}

function successMessage(action: ModerationSubmissionAction): string {
  if (action === 'CLAIM') return 'Case claimed. The latest case details are now shown.';
  if (action === 'RELEASE') return 'Case released back to the moderation queue.';
  if (action === 'REOPEN') return 'Case reopened and returned to the moderation queue.';
  return 'Decision recorded. The latest case details are now shown.';
}

function isAmbiguousFailure(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === 0 || error.status >= 500 || error.code === 'INVALID_API_RESPONSE')
  );
}

function createIntent(
  action: ModerationWorkflowAction,
  moderationCase: ModerationCaseDetail,
  reason?: string,
): ActionIntent | null {
  const revisions = {
    clientActionId: Crypto.randomUUID(),
    expectedCaseRevision: moderationCase.caseRevision,
    expectedLifecycleRevision: moderationCase.incident.lifecycleRevision,
  } as const;

  if (action === 'CLAIM') {
    return Object.freeze({
      action,
      caseId: moderationCase.id,
      input: Object.freeze(revisions),
    });
  }

  const normalizedReason = reason?.trim() ?? '';
  if (normalizedReason.length < 1 || normalizedReason.length > 1000) return null;
  return Object.freeze({
    action,
    caseId: moderationCase.id,
    input: Object.freeze({ ...revisions, reason: normalizedReason }),
  });
}

function createDecisionIntent(
  moderationCase: ModerationCaseDetail,
  decision: ModerationDecisionIntent,
): ActionIntent | null {
  const reason = decision.reason.trim();
  if (reason.length < 1 || reason.length > 1000) return null;

  const relatedIncidentId = decision.relatedIncidentId?.trim().toLowerCase();
  if (
    decision.action === 'ARCHIVE_DUPLICATE' &&
    (!relatedIncidentId ||
      !/^[0-9a-f]{24}$/.test(relatedIncidentId) ||
      relatedIncidentId === moderationCase.incident.id.toLowerCase())
  ) {
    return null;
  }

  const input = Object.freeze({
    clientActionId: Crypto.randomUUID(),
    expectedCaseRevision: moderationCase.caseRevision,
    expectedLifecycleRevision: moderationCase.incident.lifecycleRevision,
    action: decision.action,
    reason,
    ...(decision.action === 'ARCHIVE_DUPLICATE' ? { relatedIncidentId } : {}),
  });

  return Object.freeze({
    action: 'DECISION',
    caseId: moderationCase.id,
    input,
  });
}

export function useModerationAction(
  accessToken: string | null,
  { refreshCase, recoverSession }: ModerationActionDependencies,
): ModerationActionState {
  const [submittingAction, setSubmittingAction] =
    useState<ModerationSubmissionAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  const inFlight = useRef(false);
  const retryIntent = useRef<ActionIntent | null>(null);

  const perform = useCallback(
    async (intent: ActionIntent): Promise<void> => {
      if (inFlight.current) return;
      if (!accessToken) {
        setError('Your moderator session is unavailable. Return to Profile and try again.');
        return;
      }

      inFlight.current = true;
      setSubmittingAction(intent.action);
      setError(null);
      setSuccess(null);
      setReviewRequired(false);

      try {
        if (intent.action === 'CLAIM') {
          await moderationApi.claim(accessToken, intent.caseId, intent.input);
        } else if (intent.action === 'RELEASE') {
          await moderationApi.release(accessToken, intent.caseId, intent.input);
        } else if (intent.action === 'REOPEN') {
          await moderationApi.reopen(accessToken, intent.caseId, intent.input);
        } else {
          await moderationApi.decide(accessToken, intent.caseId, intent.input);
        }

        retryIntent.current = null;
        setRetryAvailable(false);
        setSuccess(successMessage(intent.action));
        await refreshCase();
      } catch (caught) {
        if (isAmbiguousFailure(caught)) {
          retryIntent.current = intent;
          setRetryAvailable(true);
          setError(
            'The result could not be confirmed. Retry to safely resend the exact same action, or cancel and refresh the case.',
          );
        } else if (caught instanceof ApiError && caught.status === 401) {
          retryIntent.current = intent;
          setRetryAvailable(true);
          setError('Your session expired. After recovery, retry the same action to confirm its result.');
          await recoverSession();
        } else {
          retryIntent.current = null;
          setRetryAvailable(false);
          if (caught instanceof ApiError && caught.status === 409) {
            setReviewRequired(true);
            setError(
              'Another moderator changed this case. The latest details have been loaded; review them before trying again.',
            );
            await refreshCase();
          } else if (caught instanceof ApiError && caught.status === 403) {
            setReviewRequired(true);
            setError('You no longer have permission or assignment access for this action.');
            await refreshCase();
          } else if (caught instanceof ApiError && caught.status === 404) {
            setReviewRequired(true);
            setError('This moderation case is unavailable or no longer exists.');
            await refreshCase();
          } else {
            setError(
              caught instanceof ApiError
                ? caught.message
                : 'The moderation action could not be completed. Please try again.',
            );
          }
        }
      } finally {
        inFlight.current = false;
        setSubmittingAction(null);
      }
    },
    [accessToken, recoverSession, refreshCase],
  );

  async function submit(
    action: ModerationWorkflowAction,
    moderationCase: ModerationCaseDetail,
    reason?: string,
  ): Promise<void> {
    if (inFlight.current || retryIntent.current) return;
    const intent = createIntent(action, moderationCase, reason);
    if (!intent) {
      setError('Enter a reason between 1 and 1000 characters.');
      return;
    }
    await perform(intent);
  }

  async function retry(): Promise<void> {
    if (inFlight.current || !retryIntent.current) return;
    await perform(retryIntent.current);
  }

  async function submitDecision(
    moderationCase: ModerationCaseDetail,
    decision: ModerationDecisionIntent,
  ): Promise<void> {
    if (inFlight.current || retryIntent.current) return;
    const intent = createDecisionIntent(moderationCase, decision);
    if (!intent) {
      setError('Review the decision reason and related incident ID before continuing.');
      return;
    }
    await perform(intent);
  }

  function clearFeedback(): void {
    if (inFlight.current) return;
    retryIntent.current = null;
    setRetryAvailable(false);
    setError(null);
    setSuccess(null);
    setReviewRequired(false);
  }

  return {
    submitting: submittingAction !== null,
    submittingAction,
    error,
    successMessage: success,
    retryAvailable,
    reviewRequired,
    submit,
    submitDecision,
    retry,
    clearFeedback,
  };
}
