import { apiRequest } from '@/src/services/api/client';
import { apiEndpoints } from '@/src/services/api/endpoints';

import type {
  ClaimModerationCaseInput,
  DecideModerationCaseInput,
  ModerationAuditHistoryItem,
  ModerationCaseDetail,
  ModerationCaseQueuePage,
  ModerationCaseQueueQuery,
  ReasonedModerationCaseInput,
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

async function workflowMutation(
  accessToken: string,
  endpoint: string,
  input: ClaimModerationCaseInput | ReasonedModerationCaseInput,
): Promise<ModerationCaseDetail> {
  const data = await apiRequest<{ case: ModerationCaseDetail }>(endpoint, {
    method: 'POST',
    accessToken,
    body: input,
  });
  return data.case;
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

  claim(
    accessToken: string,
    caseId: string,
    input: ClaimModerationCaseInput,
  ): Promise<ModerationCaseDetail> {
    return workflowMutation(accessToken, apiEndpoints.moderation.claim(caseId), input);
  },

  release(
    accessToken: string,
    caseId: string,
    input: ReasonedModerationCaseInput,
  ): Promise<ModerationCaseDetail> {
    return workflowMutation(accessToken, apiEndpoints.moderation.release(caseId), input);
  },

  reopen(
    accessToken: string,
    caseId: string,
    input: ReasonedModerationCaseInput,
  ): Promise<ModerationCaseDetail> {
    return workflowMutation(accessToken, apiEndpoints.moderation.reopen(caseId), input);
  },

  decide(
    accessToken: string,
    caseId: string,
    input: DecideModerationCaseInput,
  ): Promise<ModerationCaseDetail> {
    return workflowMutation(accessToken, apiEndpoints.moderation.decision(caseId), input);
  },
};
