import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/src/services/api/errors';

import { moderationApi } from '../moderation-api';
import type {
  ClaimModerationCaseInput,
  ModerationCaseDetail,
  ReasonedModerationCaseInput,
} from '../moderation.types';

export type ModerationWorkflowAction = 'CLAIM' | 'RELEASE' | 'REOPEN';

type WorkflowIntent =
  | {
      readonly action: 'CLAIM';
      readonly caseId: string;
      readonly input: Readonly<ClaimModerationCaseInput>;
    }
  | {
      readonly action: 'RELEASE' | 'REOPEN';
      readonly caseId: string;
      readonly input: Readonly<ReasonedModerationCaseInput>;
    };

interface ModerationActionDependencies {
  refreshCase(): Promise<void>;
  recoverSession(): Promise<void>;
}

export interface ModerationActionState {
  submitting: boolean;
  submittingAction: ModerationWorkflowAction | null;
  error: string | null;
  successMessage: string | null;
  retryAvailable: boolean;
  submit(
    action: ModerationWorkflowAction,
    moderationCase: ModerationCaseDetail,
    reason?: string,
  ): Promise<void>;
  retry(): Promise<void>;
  clearFeedback(): void;
}

function successMessage(action: ModerationWorkflowAction): string {
  if (action === 'CLAIM') return 'Case claimed. The latest case details are now shown.';
  if (action === 'RELEASE') return 'Case released back to the moderation queue.';
  return 'Case reopened and returned to the moderation queue.';
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
): WorkflowIntent | null {
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

export function useModerationAction(
  accessToken: string | null,
  { refreshCase, recoverSession }: ModerationActionDependencies,
): ModerationActionState {
  const [submittingAction, setSubmittingAction] =
    useState<ModerationWorkflowAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const inFlight = useRef(false);
  const retryIntent = useRef<WorkflowIntent | null>(null);

  const perform = useCallback(
    async (intent: WorkflowIntent): Promise<void> => {
      if (inFlight.current) return;
      if (!accessToken) {
        setError('Your moderator session is unavailable. Return to Profile and try again.');
        return;
      }

      inFlight.current = true;
      setSubmittingAction(intent.action);
      setError(null);
      setSuccess(null);

      try {
        if (intent.action === 'CLAIM') {
          await moderationApi.claim(accessToken, intent.caseId, intent.input);
        } else if (intent.action === 'RELEASE') {
          await moderationApi.release(accessToken, intent.caseId, intent.input);
        } else {
          await moderationApi.reopen(accessToken, intent.caseId, intent.input);
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
            setError(
              'Another moderator changed this case. The latest details have been loaded; review them before trying again.',
            );
            await refreshCase();
          } else if (caught instanceof ApiError && caught.status === 403) {
            setError('You no longer have permission or assignment access for this action.');
            await refreshCase();
          } else if (caught instanceof ApiError && caught.status === 404) {
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

  function clearFeedback(): void {
    if (inFlight.current) return;
    retryIntent.current = null;
    setRetryAvailable(false);
    setError(null);
    setSuccess(null);
  }

  return {
    submitting: submittingAction !== null,
    submittingAction,
    error,
    successMessage: success,
    retryAvailable,
    submit,
    retry,
    clearFeedback,
  };
}
