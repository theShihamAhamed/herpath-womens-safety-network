/// <reference types="jest" />

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';

import { ApiError } from '@/src/services/api/errors';

import { communityVerificationApi } from './community-verification-api';
import type {
  CommunityVerificationStatus,
  FeedbackEligibility,
} from './community-verification.types';
import { ReportCommunityPanel } from './report-community-panel';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('@/src/features/auth/auth-provider', () => ({
  useAuth: () => ({ accessToken: 'access-token', status: 'ready' }),
}));
jest.mock('./community-verification-api', () => ({
  communityVerificationApi: {
    status: jest.fn(),
    eligibility: jest.fn(),
    submitFeedback: jest.fn(),
    removeFeedback: jest.fn(),
    submitFlag: jest.fn(),
  },
}));

const status: CommunityVerificationStatus = {
  evidence: {
    communityState: 'UNVERIFIED',
    supportCount: 1,
    activeFeedbackCount: 2,
    contributingFeedbackCount: 1,
    evaluatedAt: '2026-08-24T10:05:00.000Z',
  },
  myFeedback: null,
};

const eligible: FeedbackEligibility = {
  canSubmit: true,
  canReplace: false,
  reason: 'ELIGIBLE',
  nextEligibleAt: null,
  currentResponse: null,
  eligibilityBasis: 'AUTHENTICATED_ACTOR_V1',
};

const api = jest.mocked(communityVerificationApi);
const randomUUID = jest.mocked(Crypto.randomUUID);

function apiError(code = 'NETWORK_ERROR', message = 'Connection failed', statusCode = 0) {
  return new ApiError({ status: statusCode, code, message });
}

function withFeedback(response: 'SUPPORT' | 'RESOLVED' | 'DISPUTE' | 'UNSURE'): CommunityVerificationStatus {
  return {
    evidence: { ...status.evidence, supportCount: response === 'SUPPORT' ? 2 : 1 },
    myFeedback: {
      response,
      submittedAt: '2026-08-24T10:10:00.000Z',
      contributesUntil: '2026-09-23T10:10:00.000Z',
    },
  };
}

async function renderLoaded(overrides?: {
  status?: CommunityVerificationStatus;
  eligibility?: FeedbackEligibility;
  onIncidentChanged?: jest.Mock;
}) {
  api.status.mockResolvedValue(overrides?.status ?? status);
  api.eligibility.mockResolvedValue(overrides?.eligibility ?? eligible);
  const screen = render(
    <ReportCommunityPanel
      incidentId="507f1f77bcf86cd799439011"
      onIncidentChanged={overrides?.onIncidentChanged}
    />,
  );
  await screen.findByText('Community evidence');
  return screen;
}

describe('ReportCommunityPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    randomUUID.mockReturnValue('11111111-1111-4111-8111-111111111111');
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('loads status and eligibility, exposes accessible choices, and does not render private fields', async () => {
    const privatePayload = {
      ...status,
      reporterId: 'private-reporter',
      privateLocation: { coordinates: [79.8612, 6.9271] },
      actorId: 'private-actor',
      evidence: { ...status.evidence, weightedScores: { support: 99 } },
    } as CommunityVerificationStatus;
    const screen = await renderLoaded({ status: privatePayload });

    expect(api.status).toHaveBeenCalledWith('access-token', '507f1f77bcf86cd799439011', expect.any(AbortSignal));
    expect(api.eligibility).toHaveBeenCalledWith('access-token', '507f1f77bcf86cd799439011', expect.any(AbortSignal));
    expect(screen.getByText('1 community support')).toBeTruthy();
    expect(screen.getByLabelText('I support this report').props.accessibilityState).toEqual({
      checked: false,
      disabled: false,
    });
    expect(screen.queryByText(/private-reporter|private-actor|79\.8612|99/)).toBeNull();
  });

  it('blocks own-report feedback and flagging with an explanatory state', async () => {
    const screen = await renderLoaded({
      eligibility: { ...eligible, canSubmit: false, reason: 'OWN_REPORT' },
    });

    expect(screen.getByText(/cannot add community feedback or flag your own report/i)).toBeTruthy();
    expect(screen.getByLabelText('I support this report').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/cannot flag your own report/i)).toBeTruthy();
    expect(screen.queryByLabelText('Submit incident report')).toBeNull();
  });

  it('shows the backend cooldown and disables replacement and removal', async () => {
    const screen = await renderLoaded({
      status: withFeedback('SUPPORT'),
      eligibility: {
        ...eligible,
        canSubmit: false,
        canReplace: false,
        reason: 'COOLDOWN_ACTIVE',
        nextEligibleAt: '2026-08-24T10:30:00.000Z',
        currentResponse: 'SUPPORT',
      },
    });

    expect(screen.getByText(/change or remove your response after/i)).toBeTruthy();
    expect(screen.getByLabelText('I dispute this report').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Remove community response').props.accessibilityState.disabled).toBe(true);
  });

  it('shows a local retry state when expansion loading fails', async () => {
    api.status.mockRejectedValueOnce(apiError()).mockResolvedValueOnce(status);
    api.eligibility.mockResolvedValue(eligible);
    const screen = render(<ReportCommunityPanel incidentId="507f1f77bcf86cd799439011" />);

    await screen.findByText('Community information unavailable');
    fireEvent.press(screen.getByLabelText('Retry community information'));

    await screen.findByText('Community evidence');
    expect(api.status).toHaveBeenCalledTimes(2);
  });

  it('shows an unavailable state without exposing mutation controls', async () => {
    api.status.mockRejectedValue(apiError('INCIDENT_NOT_AVAILABLE', 'Unavailable', 404));
    api.eligibility.mockResolvedValue({
      ...eligible,
      canSubmit: false,
      reason: 'INCIDENT_NOT_PUBLIC',
    });
    const screen = render(<ReportCommunityPanel incidentId="507f1f77bcf86cd799439011" />);

    await screen.findByText('Report unavailable');
    expect(screen.queryByLabelText('I support this report')).toBeNull();
    expect(screen.queryByLabelText('Submit incident report')).toBeNull();
  });

  it('submits feedback with the exact contract and refreshes the canonical incident aggregate', async () => {
    const onIncidentChanged = jest.fn();
    const nextStatus = withFeedback('SUPPORT');
    api.submitFeedback.mockResolvedValue(nextStatus);
    const screen = await renderLoaded({ onIncidentChanged });

    fireEvent.press(screen.getByLabelText('I support this report'));

    await waitFor(() => expect(api.submitFeedback).toHaveBeenCalledWith(
      'access-token',
      '507f1f77bcf86cd799439011',
      { clientFeedbackId: '11111111-1111-4111-8111-111111111111', response: 'SUPPORT' },
    ));
    await screen.findByText('Your response: I support this report');
    expect(onIncidentChanged).toHaveBeenCalledWith({
      incidentId: '507f1f77bcf86cd799439011',
      evidence: nextStatus.evidence,
    });
  });

  it('reuses the same feedback UUID when retrying the same failed intent', async () => {
    api.submitFeedback.mockRejectedValueOnce(apiError()).mockResolvedValueOnce(withFeedback('SUPPORT'));
    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('I support this report'));
    await screen.findByLabelText('Retry community response');
    fireEvent.press(screen.getByLabelText('Retry community response'));

    await waitFor(() => expect(api.submitFeedback).toHaveBeenCalledTimes(2));
    expect(api.submitFeedback.mock.calls[0]?.[2]).toEqual(api.submitFeedback.mock.calls[1]?.[2]);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('uses the supported replacement contract for a changed response', async () => {
    const replacement = withFeedback('DISPUTE');
    api.submitFeedback.mockResolvedValue(replacement);
    const screen = await renderLoaded({
      status: withFeedback('SUPPORT'),
      eligibility: { ...eligible, canReplace: true, currentResponse: 'SUPPORT' },
    });
    fireEvent.press(screen.getByLabelText('I dispute this report'));

    await waitFor(() => expect(api.submitFeedback).toHaveBeenCalledWith(
      'access-token',
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ response: 'DISPUTE' }),
    ));
    await screen.findByText('Your response: I dispute this report');
  });

  it('confirms removal, preserves feedback on failure, and updates after success', async () => {
    api.removeFeedback.mockRejectedValueOnce(apiError()).mockResolvedValueOnce(status);
    const screen = await renderLoaded({
      status: withFeedback('SUPPORT'),
      eligibility: { ...eligible, canReplace: true, currentResponse: 'SUPPORT' },
    });
    api.eligibility.mockResolvedValue({
      ...eligible,
      canSubmit: false,
      reason: 'COOLDOWN_ACTIVE',
      nextEligibleAt: '2026-08-24T10:30:00.000Z',
      currentResponse: null,
    });

    fireEvent.press(screen.getByLabelText('Remove community response'));
    expect(api.removeFeedback).not.toHaveBeenCalled();
    const firstConfirm = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2]?.find((button) => button.style === 'destructive');
    act(() => firstConfirm?.onPress?.());
    await screen.findByText('Connection failed');
    expect(screen.getByText('Your response: I support this report')).toBeTruthy();
    await waitFor(() => expect(
      screen.getByLabelText('Remove community response').props.accessibilityState.disabled,
    ).toBe(false));

    fireEvent.press(screen.getByLabelText('Remove community response'));
    expect(jest.mocked(Alert.alert)).toHaveBeenCalledTimes(2);
    const secondConfirm = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2]?.find((button) => button.style === 'destructive');
    act(() => secondConfirm?.onPress?.());
    await waitFor(() => expect(api.removeFeedback).toHaveBeenCalledTimes(2));
    await screen.findByText('You have not responded to this report.');
  });

  it('validates the required flag reason and 500-character details limit', async () => {
    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Submit incident report'));
    expect(screen.getByText(/choose a reason/i)).toBeTruthy();
    expect(api.submitFlag).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Flag reason: Other'));
    fireEvent.changeText(screen.getByLabelText('Flag additional details'), 'x'.repeat(501));
    fireEvent.press(screen.getByLabelText('Submit incident report'));
    expect(screen.getByText(/at most 500 characters/i)).toBeTruthy();
    expect(api.submitFlag).not.toHaveBeenCalled();
  });

  it('submits flags with the exact contract and reuses the UUID on retry', async () => {
    api.submitFlag
      .mockRejectedValueOnce(apiError())
      .mockResolvedValueOnce({
        id: 'flag-1',
        incidentId: '507f1f77bcf86cd799439011',
        reason: 'MISLEADING',
        details: 'Incorrect context',
        submittedAt: '2026-08-24T10:20:00.000Z',
      });
    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Flag reason: Misleading'));
    fireEvent.changeText(screen.getByLabelText('Flag additional details'), '  Incorrect context  ');
    fireEvent.press(screen.getByLabelText('Submit incident report'));
    await screen.findByLabelText('Retry incident report');
    fireEvent.press(screen.getByLabelText('Retry incident report'));

    await waitFor(() => expect(api.submitFlag).toHaveBeenCalledTimes(2));
    expect(api.submitFlag.mock.calls[0]?.[2]).toEqual({
      clientFlagId: '11111111-1111-4111-8111-111111111111',
      reason: 'MISLEADING',
      details: 'Incorrect context',
    });
    expect(api.submitFlag.mock.calls[1]?.[2]).toEqual(api.submitFlag.mock.calls[0]?.[2]);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    await screen.findByText(/already reported this incident/i);
  });

  it('treats FLAG_ALREADY_SUBMITTED as a stable already-reported state', async () => {
    api.submitFlag.mockRejectedValue(apiError('FLAG_ALREADY_SUBMITTED', 'Already submitted', 409));
    const screen = await renderLoaded();

    fireEvent.press(screen.getByLabelText('Flag reason: Spam'));
    fireEvent.press(screen.getByLabelText('Submit incident report'));

    await screen.findByText(/already reported this incident/i);
    expect(screen.queryByText('Already submitted')).toBeNull();
  });
});
