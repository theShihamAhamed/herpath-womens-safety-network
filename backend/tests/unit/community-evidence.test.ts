import { describe, expect, it } from 'vitest';

import {
  BASELINE_V1_EVIDENCE_POLICY,
  evaluateCommunityEvidence,
  type CommunityEvidenceEvaluationInput,
  type CommunityEvidenceFeedbackEvent,
} from '../../src/modules/community-verification/community-evidence.service.js';
import type { IncidentLifecycleSnapshot } from '../../src/modules/incidents/incident.types.js';

const evaluatedAt = new Date('2026-08-25T12:00:00.000Z');
const recentFeedbackAt = new Date('2026-08-24T12:00:00.000Z');
const staleFeedbackAt = new Date(
  evaluatedAt.getTime() - BASELINE_V1_EVIDENCE_POLICY.staleAfterMs - 1,
);

const defaultLifecycle: IncidentLifecycleSnapshot = {
  visibilityState: 'PUBLIC',
  communityState: 'UNVERIFIED',
  moderationState: 'NOT_QUEUED',
  lifecycleRevision: 0,
};

function feedback(
  actorId: string,
  response: CommunityEvidenceFeedbackEvent['response'],
  overrides: Partial<CommunityEvidenceFeedbackEvent> = {},
): CommunityEvidenceFeedbackEvent {
  return {
    feedbackId: `feedback-${actorId}`,
    actorId,
    response,
    state: 'ACTIVE',
    weightBasis: 'BASELINE_V1',
    createdAt: recentFeedbackAt,
    ...overrides,
  };
}

function evaluate(
  feedbackEvents: readonly CommunityEvidenceFeedbackEvent[],
  lifecycle: IncidentLifecycleSnapshot = defaultLifecycle,
) {
  const input: CommunityEvidenceEvaluationInput = {
    feedbackEvents,
    lifecycle,
    evaluatedAt,
    currentEvidenceRevision: 4,
  };
  return evaluateCommunityEvidence(input);
}

describe('community evidence evaluation', () => {
  it('keeps empty evidence unverified', () => {
    const result = evaluate([]);

    expect(result.communityState).toBe('UNVERIFIED');
    expect(result.supportCount).toBe(0);
    expect(result.activeFeedbackCount).toBe(0);
    expect(result.weightedScores).toEqual({ support: 0, resolved: 0, dispute: 0 });
    expect(result.evidenceRevision).toBe(5);
    expect(result.lifecycle.lifecycleRevision).toBe(0);
  });

  it('marks sufficient independent support as supported and counts active support', () => {
    const result = evaluate([
      feedback('actor-a', 'SUPPORT'),
      feedback('actor-b', 'SUPPORT'),
      feedback('actor-c', 'SUPPORT'),
    ]);

    expect(result.communityState).toBe('SUPPORTED');
    expect(result.supportCount).toBe(3);
    expect(result.activeFeedbackCount).toBe(3);
    expect(result.contributingFeedbackCount).toBe(3);
    expect(result.weightedScores).toEqual({ support: 3, resolved: 0, dispute: 0 });
    expect(result.legacyStatus).toBe('COMMUNITY_SUPPORTED');
  });

  it('marks meaningful support and dispute evidence as conflicted', () => {
    const result = evaluate([
      feedback('actor-a', 'SUPPORT'),
      feedback('actor-b', 'SUPPORT'),
      feedback('actor-c', 'DISPUTE'),
      feedback('actor-d', 'DISPUTE'),
    ]);

    expect(result.communityState).toBe('CONFLICTED');
    expect(result.supportCount).toBe(2);
    expect(result.weightedScores).toEqual({ support: 2, resolved: 0, dispute: 2 });
    expect(result.legacyStatus).toBe('DISPUTED');
  });

  it('keeps weak disagreement unverified', () => {
    const result = evaluate([
      feedback('actor-a', 'SUPPORT'),
      feedback('actor-b', 'SUPPORT'),
      feedback('actor-c', 'DISPUTE'),
    ]);

    expect(result.communityState).toBe('UNVERIFIED');
    expect(result.supportCount).toBe(2);
    expect(result.weightedScores).toEqual({ support: 2, resolved: 0, dispute: 1 });
    expect(result.legacyStatus).toBe('PUBLISHED_UNVERIFIED');
  });

  it('marks sufficient resolved evidence without recent opposition as likely resolved', () => {
    const result = evaluate([
      feedback('actor-a', 'RESOLVED'),
      feedback('actor-b', 'RESOLVED'),
      feedback('actor-c', 'RESOLVED'),
    ]);

    expect(result.communityState).toBe('LIKELY_RESOLVED');
    expect(result.supportCount).toBe(0);
    expect(result.weightedScores).toEqual({ support: 0, resolved: 3, dispute: 0 });
    expect(result.legacyStatus).toBe('PUBLISHED_UNVERIFIED');
  });

  it('marks evidence stale when all active directional responses exceed the threshold', () => {
    const result = evaluate([
      feedback('actor-a', 'SUPPORT', { createdAt: staleFeedbackAt }),
      feedback('actor-b', 'SUPPORT', { createdAt: staleFeedbackAt }),
      feedback('actor-c', 'SUPPORT', { createdAt: staleFeedbackAt }),
    ]);

    expect(result.communityState).toBe('STALE');
    expect(result.supportCount).toBe(0);
    expect(result.activeFeedbackCount).toBe(3);
    expect(result.contributingFeedbackCount).toBe(0);
    expect(result.weightedScores).toEqual({ support: 0, resolved: 0, dispute: 0 });
  });

  it('ignores withdrawn feedback', () => {
    const result = evaluate([
      feedback('actor-a', 'SUPPORT'),
      feedback('actor-b', 'SUPPORT'),
      feedback('actor-c', 'SUPPORT'),
      feedback('actor-d', 'SUPPORT', { state: 'WITHDRAWN' }),
    ]);

    expect(result.communityState).toBe('SUPPORTED');
    expect(result.supportCount).toBe(3);
    expect(result.activeFeedbackCount).toBe(3);
  });

  it('ignores superseded history and does not double-count an actor', () => {
    const result = evaluate([
      feedback('actor-a', 'DISPUTE', {
        feedbackId: 'feedback-old',
        state: 'SUPERSEDED',
      }),
      feedback('actor-a', 'SUPPORT', { feedbackId: 'feedback-current' }),
      feedback('actor-b', 'SUPPORT'),
      feedback('actor-c', 'SUPPORT'),
    ]);

    expect(result.communityState).toBe('SUPPORTED');
    expect(result.supportCount).toBe(3);
    expect(result.activeFeedbackCount).toBe(3);
    expect(result.weightedScores).toEqual({ support: 3, resolved: 0, dispute: 0 });
  });

  it('uses the latest active event deterministically if persistence invariants are violated', () => {
    const result = evaluate([
      feedback('actor-a', 'SUPPORT', {
        feedbackId: 'feedback-older',
        createdAt: new Date('2026-08-23T12:00:00.000Z'),
      }),
      feedback('actor-a', 'DISPUTE', {
        feedbackId: 'feedback-newer',
      }),
      feedback('actor-b', 'DISPUTE'),
      feedback('actor-c', 'DISPUTE'),
    ]);

    expect(result.supportCount).toBe(0);
    expect(result.activeFeedbackCount).toBe(3);
    expect(result.weightedScores).toEqual({ support: 0, resolved: 0, dispute: 3 });
    expect(result.communityState).toBe('UNVERIFIED');
  });

  it('does not treat unsure responses as directional evidence', () => {
    const result = evaluate([
      feedback('actor-a', 'UNSURE'),
      feedback('actor-b', 'UNSURE'),
      feedback('actor-c', 'UNSURE'),
    ]);

    expect(result.communityState).toBe('UNVERIFIED');
    expect(result.activeFeedbackCount).toBe(3);
    expect(result.contributingFeedbackCount).toBe(0);
  });

  it('preserves visibility and moderation while incrementing lifecycle revision on change', () => {
    const lifecycle: IncidentLifecycleSnapshot = {
      visibilityState: 'HIDDEN',
      communityState: 'UNVERIFIED',
      moderationState: 'IN_REVIEW',
      lifecycleRevision: 8,
    };
    const result = evaluate(
      [
        feedback('actor-a', 'SUPPORT'),
        feedback('actor-b', 'SUPPORT'),
        feedback('actor-c', 'SUPPORT'),
      ],
      lifecycle,
    );

    expect(result.lifecycle).toEqual({
      visibilityState: 'HIDDEN',
      communityState: 'SUPPORTED',
      moderationState: 'IN_REVIEW',
      lifecycleRevision: 9,
    });
    expect(result.legacyStatus).toBe('REJECTED');
  });

  it('does not mutate lifecycle or feedback inputs', () => {
    const lifecycle = { ...defaultLifecycle };
    const events = [feedback('actor-a', 'SUPPORT')];
    const lifecycleBefore = { ...lifecycle };
    const eventBefore = { ...events[0] };

    evaluate(events, lifecycle);

    expect(lifecycle).toEqual(lifecycleBefore);
    expect(events[0]).toEqual(eventBefore);
  });
});
