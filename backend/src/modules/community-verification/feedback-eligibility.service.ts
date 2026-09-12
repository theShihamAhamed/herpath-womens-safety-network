import type { IncidentVisibilityState } from '../incidents/incident.types.js';
import type { FeedbackEventState, FeedbackResponse } from './community-verification.types.js';

const MINUTE_MS = 60 * 1_000;

export const FEEDBACK_ELIGIBILITY_REASONS = [
  'ELIGIBLE',
  'AUTHENTICATION_REQUIRED',
  'INCIDENT_NOT_FOUND',
  'INCIDENT_NOT_PUBLIC',
  'OWN_REPORT',
  'COOLDOWN_ACTIVE',
] as const;

export type FeedbackEligibilityReason = (typeof FEEDBACK_ELIGIBILITY_REASONS)[number];

export interface FeedbackEligibilityPolicy {
  mutationCooldownMs: number;
}

export const BASELINE_V1_ELIGIBILITY_POLICY: Readonly<FeedbackEligibilityPolicy> = {
  mutationCooldownMs: 15 * MINUTE_MS,
};

export interface FeedbackEligibilityIncident {
  id: string;
  reporterId: string;
  visibilityState: IncidentVisibilityState;
}

export interface FeedbackEligibilityRecord {
  response: FeedbackResponse;
  state: FeedbackEventState;
  updatedAt: Date;
}

export interface FeedbackEligibilityInput {
  actorId: string | null;
  incident: FeedbackEligibilityIncident | null;
  latestFeedback: FeedbackEligibilityRecord | null;
  evaluatedAt: Date;
}

export interface FeedbackEligibilityResult {
  canSubmit: boolean;
  canReplace: boolean;
  reason: FeedbackEligibilityReason;
  nextEligibleAt: Date | null;
  currentResponse: FeedbackResponse | null;
  eligibilityBasis: 'AUTHENTICATED_ACTOR_V1';
}

function result(
  reason: FeedbackEligibilityReason,
  overrides: Partial<FeedbackEligibilityResult> = {},
): FeedbackEligibilityResult {
  return {
    canSubmit: false,
    canReplace: false,
    reason,
    nextEligibleAt: null,
    currentResponse: null,
    eligibilityBasis: 'AUTHENTICATED_ACTOR_V1',
    ...overrides,
  };
}

export function evaluateFeedbackEligibility(
  input: FeedbackEligibilityInput,
  policy: Readonly<FeedbackEligibilityPolicy> = BASELINE_V1_ELIGIBILITY_POLICY,
): FeedbackEligibilityResult {
  if (!input.actorId) return result('AUTHENTICATION_REQUIRED');
  if (!input.incident) return result('INCIDENT_NOT_FOUND');
  if (input.incident.visibilityState !== 'PUBLIC') return result('INCIDENT_NOT_PUBLIC');
  if (input.incident.reporterId === input.actorId) return result('OWN_REPORT');

  if (input.latestFeedback) {
    const nextEligibleAt = new Date(
      input.latestFeedback.updatedAt.getTime() + policy.mutationCooldownMs,
    );
    if (nextEligibleAt.getTime() > input.evaluatedAt.getTime()) {
      return result('COOLDOWN_ACTIVE', {
        nextEligibleAt,
        currentResponse:
          input.latestFeedback.state === 'ACTIVE' ? input.latestFeedback.response : null,
      });
    }
  }

  return result('ELIGIBLE', {
    canSubmit: true,
    canReplace: input.latestFeedback?.state === 'ACTIVE',
    currentResponse:
      input.latestFeedback?.state === 'ACTIVE' ? input.latestFeedback.response : null,
  });
}

export interface FeedbackSubmissionIntent {
  incidentId: string;
  response: FeedbackResponse;
}

export interface ExistingFeedbackSubmission extends FeedbackSubmissionIntent {
  clientFeedbackId: string;
}

export type FeedbackReplayClassification = 'NEW' | 'REPLAY';

export class FeedbackIdempotencyConflictError extends Error {
  public constructor() {
    super('This feedback identifier was already used for different feedback content');
    this.name = 'FeedbackIdempotencyConflictError';
  }
}

export function classifyFeedbackReplay(
  existing: ExistingFeedbackSubmission | null,
  intent: FeedbackSubmissionIntent,
): FeedbackReplayClassification {
  if (!existing) return 'NEW';
  if (existing.incidentId === intent.incidentId && existing.response === intent.response) {
    return 'REPLAY';
  }
  throw new FeedbackIdempotencyConflictError();
}
