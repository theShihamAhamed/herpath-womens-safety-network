import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/src/services/api/errors';

import { moderationApi } from '../moderation-api';
import type { ModerationAuditHistoryItem } from '../moderation.types';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function auditErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your moderator session could not be verified. Recover the session and try again.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Moderator access is unavailable for this account.';
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'This moderation case is unavailable or no longer exists.';
  }
  return 'The audit history could not be loaded. Check your connection and try again.';
}

export interface ModerationAuditsState {
  audits: ModerationAuditHistoryItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  errorStatus: number | null;
  reload(): Promise<void>;
  refresh(): Promise<void>;
}

export function useModerationAudits(
  accessToken: string | null,
  caseId: string | null,
): ModerationAuditsState {
  const [audits, setAudits] = useState<ModerationAuditHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const requestGeneration = useRef(0);

  const load = useCallback(
    async (asRefresh: boolean): Promise<void> => {
      const generation = requestGeneration.current + 1;
      requestGeneration.current = generation;
      setError(null);
      setErrorStatus(null);

      if (!caseId || !OBJECT_ID.test(caseId)) {
        setAudits([]);
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
        const nextAudits = await moderationApi.getAudits(accessToken, caseId);
        if (requestGeneration.current !== generation) return;
        setAudits(nextAudits);
      } catch (caught) {
        if (requestGeneration.current !== generation) return;
        if (
          caught instanceof ApiError &&
          (caught.status === 401 || caught.status === 403 || caught.status === 404)
        ) {
          setAudits([]);
        }
        setError(auditErrorMessage(caught));
        setErrorStatus(caught instanceof ApiError ? caught.status : 0);
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
    setAudits([]);
    void load(false);

    return () => {
      requestGeneration.current += 1;
    };
  }, [load]);

  return {
    audits,
    loading,
    refreshing,
    error,
    errorStatus,
    reload: () => load(false),
    refresh: () => load(true),
  };
}
