import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/src/services/api/errors';

import { moderationApi } from '../moderation-api';
import type {
  ModerationQueueCase,
  ModerationQueueFilters,
} from '../moderation.types';

const PAGE_LIMIT = 20;

function queueErrorMessage(error: unknown, loadingMore = false): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your moderator session could not be verified. Return to Profile and sign in again.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Moderator access is unavailable for this account.';
  }
  return loadingMore
    ? 'More moderation cases could not be loaded. Please try again.'
    : 'Moderation cases could not be loaded. Check your connection and try again.';
}

export interface ModerationQueueState {
  cases: ModerationQueueCase[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  cursor: string | null;
  hasMore: boolean;
  reload(): Promise<void>;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
}

export function useModerationQueue(
  accessToken: string | null,
  filters: ModerationQueueFilters,
): ModerationQueueState {
  const [cases, setCases] = useState<ModerationQueueCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const loadingMoreRef = useRef(false);

  const { assignment, priority, state } = filters;

  const loadFirstPage = useCallback(
    async (asRefresh: boolean): Promise<void> => {
      const generation = requestGeneration.current + 1;
      requestGeneration.current = generation;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setError(null);

      if (!accessToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (asRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const page = await moderationApi.listCases(accessToken, {
          state,
          assignment,
          ...(priority === undefined ? {} : { priority }),
          limit: PAGE_LIMIT,
        });
        if (requestGeneration.current !== generation) return;
        setCases(page.items);
        setCursor(page.nextCursor);
      } catch (caught) {
        if (requestGeneration.current !== generation) return;
        setError(queueErrorMessage(caught));
      } finally {
        if (requestGeneration.current === generation) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [accessToken, assignment, priority, state],
  );

  useEffect(() => {
    setCases([]);
    setCursor(null);
    setError(null);
    void loadFirstPage(false);

    return () => {
      requestGeneration.current += 1;
      loadingMoreRef.current = false;
    };
  }, [loadFirstPage]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!accessToken || !cursor || loadingMoreRef.current) return;

    const generation = requestGeneration.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);

    try {
      const page = await moderationApi.listCases(accessToken, {
        state,
        assignment,
        ...(priority === undefined ? {} : { priority }),
        limit: PAGE_LIMIT,
        cursor,
      });
      if (requestGeneration.current !== generation) return;
      setCases((current) => {
        const existingIds = new Set(current.map((moderationCase) => moderationCase.id));
        return [
          ...current,
          ...page.items.filter((moderationCase) => !existingIds.has(moderationCase.id)),
        ];
      });
      setCursor(page.nextCursor);
    } catch (caught) {
      if (requestGeneration.current === generation) {
        setError(queueErrorMessage(caught, true));
      }
    } finally {
      if (requestGeneration.current === generation) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [accessToken, assignment, cursor, priority, state]);

  return {
    cases,
    loading,
    refreshing,
    loadingMore,
    error,
    cursor,
    hasMore: cursor !== null,
    reload: () => loadFirstPage(false),
    refresh: () => loadFirstPage(true),
    loadMore,
  };
}
