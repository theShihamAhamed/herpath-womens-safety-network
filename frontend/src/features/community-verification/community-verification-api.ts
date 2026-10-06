import { apiRequest } from '@/src/services/api/client';
import { apiEndpoints } from '@/src/services/api/endpoints';

import type {
  CommunityVerificationStatus,
  FeedbackEligibility,
  IncidentFlag,
  SubmitFeedbackInput,
  SubmitFlagInput,
} from './community-verification.types';

export const communityVerificationApi = {
  status(
    accessToken: string,
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<CommunityVerificationStatus> {
    return apiRequest<CommunityVerificationStatus>(apiEndpoints.incidents.verification(incidentId), {
      accessToken,
      signal,
    });
  },

  eligibility(
    accessToken: string,
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<FeedbackEligibility> {
    return apiRequest<FeedbackEligibility>(apiEndpoints.incidents.feedbackEligibility(incidentId), {
      accessToken,
      signal,
    });
  },

  submitFeedback(
    accessToken: string,
    incidentId: string,
    input: SubmitFeedbackInput,
  ): Promise<CommunityVerificationStatus> {
    return apiRequest<CommunityVerificationStatus>(apiEndpoints.incidents.feedback(incidentId), {
      method: 'POST',
      accessToken,
      body: input,
    });
  },

  removeFeedback(accessToken: string, incidentId: string): Promise<CommunityVerificationStatus> {
    return apiRequest<CommunityVerificationStatus>(apiEndpoints.incidents.feedback(incidentId), {
      method: 'DELETE',
      accessToken,
    });
  },

  async submitFlag(
    accessToken: string,
    incidentId: string,
    input: SubmitFlagInput,
  ): Promise<IncidentFlag> {
    const data = await apiRequest<{ flag: IncidentFlag }>(apiEndpoints.incidents.flags(incidentId), {
      method: 'POST',
      accessToken,
      body: input,
    });
    return data.flag;
  },
};
