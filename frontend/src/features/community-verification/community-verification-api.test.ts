/// <reference types="jest" />

import { apiRequest } from '@/src/services/api/client';

import { communityVerificationApi } from './community-verification-api';

jest.mock('@/src/services/api/client', () => ({ apiRequest: jest.fn() }));

const request = jest.mocked(apiRequest);
const incidentId = '507f1f77bcf86cd799439011';

describe('communityVerificationApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the authenticated status and eligibility endpoints', async () => {
    const signal = new AbortController().signal;
    request.mockResolvedValue({});

    await communityVerificationApi.status('token', incidentId, signal);
    await communityVerificationApi.eligibility('token', incidentId, signal);

    expect(request).toHaveBeenNthCalledWith(1, `/incidents/${incidentId}/verification`, {
      accessToken: 'token',
      signal,
    });
    expect(request).toHaveBeenNthCalledWith(2, `/incidents/${incidentId}/feedback/eligibility`, {
      accessToken: 'token',
      signal,
    });
  });

  it('uses the exact feedback submit, removal, and flag contracts', async () => {
    request.mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({ flag: { id: 'flag-1' } });

    await communityVerificationApi.submitFeedback('token', incidentId, {
      clientFeedbackId: '11111111-1111-4111-8111-111111111111',
      response: 'SUPPORT',
    });
    await communityVerificationApi.removeFeedback('token', incidentId);
    await communityVerificationApi.submitFlag('token', incidentId, {
      clientFlagId: '22222222-2222-4222-8222-222222222222',
      reason: 'MISLEADING',
      details: 'Incorrect context',
    });

    expect(request).toHaveBeenNthCalledWith(1, `/incidents/${incidentId}/feedback`, {
      method: 'POST',
      accessToken: 'token',
      body: {
        clientFeedbackId: '11111111-1111-4111-8111-111111111111',
        response: 'SUPPORT',
      },
    });
    expect(request).toHaveBeenNthCalledWith(2, `/incidents/${incidentId}/feedback`, {
      method: 'DELETE',
      accessToken: 'token',
    });
    expect(request).toHaveBeenNthCalledWith(3, `/incidents/${incidentId}/flags`, {
      method: 'POST',
      accessToken: 'token',
      body: {
        clientFlagId: '22222222-2222-4222-8222-222222222222',
        reason: 'MISLEADING',
        details: 'Incorrect context',
      },
    });
  });
});
