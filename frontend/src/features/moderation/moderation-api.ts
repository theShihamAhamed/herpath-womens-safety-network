import { apiRequest } from '@/src/services/api/client';
import { apiEndpoints } from '@/src/services/api/endpoints';

import type {
  ModerationAuditHistoryItem,
  ModerationCaseDetail,
  ModerationCaseQueuePage,
  ModerationCaseQueueQuery,
} from './moderation.types';

function queueEndpoint(query: ModerationCaseQueueQuery): string {
  const params = new URLSearchParams();

  if (query.state) params.set('state', query.state);
  if (query.priority) params.set('priority', query.priority);
  if (query.assignment) params.set('assignment', query.assignment);
  if (query.limit !== undefined) params.set('limit', query.limit.toString());
  if (query.cursor) params.set('cursor', query.cursor);

  const queryString = params.toString();
  return queryString ? `${apiEndpoints.moderation.cases}?${queryString}` : apiEndpoints.moderation.cases;
}

export const moderationApi = {
  listCases(
    accessToken: string,
    query: ModerationCaseQueueQuery = {},
    signal?: AbortSignal,
  ): Promise<ModerationCaseQueuePage> {
    return apiRequest<ModerationCaseQueuePage>(queueEndpoint(query), {
      method: 'GET',
      accessToken,
      signal,
    });
  },

  async getCase(
    accessToken: string,
    caseId: string,
    signal?: AbortSignal,
  ): Promise<ModerationCaseDetail> {
    const data = await apiRequest<{ case: ModerationCaseDetail }>(
      apiEndpoints.moderation.caseById(caseId),
      { method: 'GET', accessToken, signal },
    );
    return data.case;
  },

  async getAudits(
    accessToken: string,
    caseId: string,
    signal?: AbortSignal,
  ): Promise<ModerationAuditHistoryItem[]> {
    const data = await apiRequest<{ items: ModerationAuditHistoryItem[] }>(
      apiEndpoints.moderation.audits(caseId),
      { method: 'GET', accessToken, signal },
    );
    return data.items;
  },
};
