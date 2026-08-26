import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/src/services/api/errors';

import { moderationApi } from '../moderation-api';
import type { ModerationCaseDetail } from '../moderation.types';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function caseErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your moderator session could not be verified. Return to Profile and sign in again.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Moderator access is unavailable for this account.';
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'This moderation case is unavailable or no longer exists.';
  }
  return 'The moderation case could not be loaded. Check your connection and try again.';
}

export interface ModerationCaseState {
  moderationCase: ModerationCaseDetail | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload(): Promise<void>;
  refresh(): Promise<void>;
}

export function useModerationCase(
  accessToken: string | null,
  caseId: string | null,
): ModerationCaseState {
  const [moderationCase, setModerationCase] = useState<ModerationCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);

  const load = useCallback(
    async (asRefresh: boolean): Promise<void> => {
      const generation = requestGeneration.current + 1;
      requestGeneration.current = generation;
      setError(null);

      if (!caseId || !OBJECT_ID.test(caseId)) {
        setModerationCase(null);
        setError('This moderation case link is invalid.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!accessToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (asRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const nextCase = await moderationApi.getCase(accessToken, caseId);
        if (requestGeneration.current !== generation) return;
        setModerationCase(nextCase);
      } catch (caught) {
        if (requestGeneration.current !== generation) return;
        if (
          caught instanceof ApiError &&
          (caught.status === 401 || caught.status === 403 || caught.status === 404)
        ) {
          setModerationCase(null);
        }
        setError(caseErrorMessage(caught));
      } finally {
        if (requestGeneration.current === generation) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [accessToken, caseId],
  );

  useEffect(() => {
    setModerationCase(null);
    void load(false);

    return () => {
      requestGeneration.current += 1;
    };
  }, [load]);

  return {
    moderationCase,
    loading,
    refreshing,
    error,
    reload: () => load(false),
    refresh: () => load(true),
  };
}
