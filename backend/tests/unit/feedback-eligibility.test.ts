import { describe, expect, it } from 'vitest';

import {
  BASELINE_V1_ELIGIBILITY_POLICY,
  FeedbackIdempotencyConflictError,
  classifyFeedbackReplay,
  evaluateFeedbackEligibility,
  type FeedbackEligibilityInput,
} from '../../src/modules/community-verification/feedback-eligibility.service.js';

const evaluatedAt = new Date('2026-08-25T12:00:00.000Z');

function input(overrides: Partial<FeedbackEligibilityInput> = {}): FeedbackEligibilityInput {
  return {
    actorId: 'actor-a',
    incident: {
      id: 'incident-a',
      reporterId: 'reporter-a',
      visibilityState: 'PUBLIC',
    },
    latestFeedback: null,
    evaluatedAt,
    ...overrides,
  };
}

describe('community feedback eligibility', () => {
  it('allows an authenticated non-reporter to submit on a public incident', () => {
    expect(evaluateFeedbackEligibility(input())).toEqual({
      canSubmit: true,
      canReplace: false,
      reason: 'ELIGIBLE',
      nextEligibleAt: null,
      currentResponse: null,
      eligibilityBasis: 'AUTHENTICATED_ACTOR_V1',
    });
  });

  it('rejects missing authentication, incidents, non-public incidents, and self-feedback', () => {
    expect(evaluateFeedbackEligibility(input({ actorId: null })).reason).toBe(
      'AUTHENTICATION_REQUIRED',
    );
    expect(evaluateFeedbackEligibility(input({ incident: null })).reason).toBe(
      'INCIDENT_NOT_FOUND',
    );
    expect(
      evaluateFeedbackEligibility(
        input({
          incident: { id: 'incident-a', reporterId: 'reporter-a', visibilityState: 'HIDDEN' },
        }),
      ).reason,
    ).toBe('INCIDENT_NOT_PUBLIC');
    expect(
      evaluateFeedbackEligibility(
        input({
          actorId: 'reporter-a',
        }),
      ).reason,
    ).toBe('OWN_REPORT');
  });

  it('enforces a mutation cooldown and exposes the existing active response', () => {
    const updatedAt = new Date(
      evaluatedAt.getTime() - BASELINE_V1_ELIGIBILITY_POLICY.mutationCooldownMs + 1,
    );
    const result = evaluateFeedbackEligibility(
      input({
        latestFeedback: { response: 'SUPPORT', state: 'ACTIVE', updatedAt },
      }),
    );

    expect(result.canSubmit).toBe(false);
    expect(result.canReplace).toBe(false);
    expect(result.reason).toBe('COOLDOWN_ACTIVE');
    expect(result.currentResponse).toBe('SUPPORT');
    expect(result.nextEligibleAt?.getTime()).toBe(
      updatedAt.getTime() + BASELINE_V1_ELIGIBILITY_POLICY.mutationCooldownMs,
    );
  });

  it('allows replacement after the cooldown without creating duplicate active intent', () => {
    const result = evaluateFeedbackEligibility(
      input({
        latestFeedback: {
          response: 'SUPPORT',
          state: 'ACTIVE',
          updatedAt: new Date(
            evaluatedAt.getTime() - BASELINE_V1_ELIGIBILITY_POLICY.mutationCooldownMs,
          ),
        },
      }),
    );

    expect(result).toMatchObject({
      canSubmit: true,
      canReplace: true,
      reason: 'ELIGIBLE',
      currentResponse: 'SUPPORT',
    });
  });

  it('classifies exact client feedback replays and rejects changed intent', () => {
    const existing = {
      clientFeedbackId: 'feedback-id',
      incidentId: 'incident-a',
      response: 'SUPPORT' as const,
    };

    expect(classifyFeedbackReplay(null, existing)).toBe('NEW');
    expect(classifyFeedbackReplay(existing, existing)).toBe('REPLAY');
    expect(() =>
      classifyFeedbackReplay(existing, { incidentId: 'incident-a', response: 'DISPUTE' }),
    ).toThrow(FeedbackIdempotencyConflictError);
    expect(() =>
      classifyFeedbackReplay(existing, { incidentId: 'incident-b', response: 'SUPPORT' }),
    ).toThrow(FeedbackIdempotencyConflictError);
  });
});
