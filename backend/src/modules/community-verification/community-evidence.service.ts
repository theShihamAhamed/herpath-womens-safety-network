import {
  planIncidentLifecycleTransition,
} from '../incidents/incident-lifecycle.service.js';
import type {
  IncidentCommunityState,
  IncidentLifecycleSnapshot,
  IncidentStatus,
} from '../incidents/incident.types.js';
import type {
  FeedbackEventState,
  FeedbackResponse,
  WeightBasis,
  WeightedEvidenceScores,
} from './community-verification.types.js';

const DAY_MS = 24 * 60 * 60 * 1_000;

export interface CommunityEvidencePolicy {
  staleAfterMs: number;
  minimumDirectionalWeight: number;
  dominanceRatio: number;
  meaningfulOppositionWeight: number;
}

export const BASELINE_V1_EVIDENCE_POLICY: Readonly<CommunityEvidencePolicy> = {
  staleAfterMs: 30 * DAY_MS,
  minimumDirectionalWeight: 3,
  dominanceRatio: 2 / 3,
  meaningfulOppositionWeight: 2,
};

export interface CommunityEvidenceFeedbackEvent {
  feedbackId: string;
  actorId: string;
  response: FeedbackResponse;
  state: FeedbackEventState;
  weightBasis: WeightBasis;
  createdAt: Date;
}

export interface CommunityEvidenceEvaluationInput {
  feedbackEvents: readonly CommunityEvidenceFeedbackEvent[];
  lifecycle: IncidentLifecycleSnapshot;
  evaluatedAt: Date;
  currentEvidenceRevision: number;
}

export interface CommunityEvidenceEvaluationResult {
  communityState: IncidentCommunityState;
  supportCount: number;
  activeFeedbackCount: number;
  contributingFeedbackCount: number;
  weightedScores: WeightedEvidenceScores;
  evidenceRevision: number;
  lifecycle: IncidentLifecycleSnapshot;
  legacyStatus: IncidentStatus;
}

function isDirectionalResponse(
  response: FeedbackResponse,
): response is Exclude<FeedbackResponse, 'UNSURE'> {
  return response !== 'UNSURE';
}

function compareFeedbackEvents(
  left: CommunityEvidenceFeedbackEvent,
  right: CommunityEvidenceFeedbackEvent,
): number {
  const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime();
  return createdAtDifference === 0
    ? left.feedbackId.localeCompare(right.feedbackId)
    : createdAtDifference;
}

function distinctActiveFeedback(
  feedbackEvents: readonly CommunityEvidenceFeedbackEvent[],
): CommunityEvidenceFeedbackEvent[] {
  const byActor = new Map<string, CommunityEvidenceFeedbackEvent>();

  for (const event of feedbackEvents) {
    if (event.state !== 'ACTIVE') continue;

    const existing = byActor.get(event.actorId);
    if (!existing || compareFeedbackEvents(existing, event) < 0) {
      byActor.set(event.actorId, event);
    }
  }

  return [...byActor.values()];
}

function baselineWeight(weightBasis: WeightBasis): number {
  switch (weightBasis) {
    case 'BASELINE_V1':
      return 1;
  }
}

function deriveCommunityState(
  scores: WeightedEvidenceScores,
  hasExpiredDirectionalEvidence: boolean,
  policy: CommunityEvidencePolicy,
): IncidentCommunityState {
  const totalWeight = scores.support + scores.resolved + scores.dispute;

  if (totalWeight === 0) {
    return hasExpiredDirectionalEvidence ? 'STALE' : 'UNVERIFIED';
  }

  if (totalWeight < policy.minimumDirectionalWeight) return 'UNVERIFIED';

  const supportOpposition = scores.resolved + scores.dispute;
  if (
    scores.support >= policy.minimumDirectionalWeight &&
    scores.support / totalWeight >= policy.dominanceRatio &&
    supportOpposition < policy.meaningfulOppositionWeight
  ) {
    return 'SUPPORTED';
  }

  const resolvedOpposition = scores.support + scores.dispute;
  if (
    scores.resolved >= policy.minimumDirectionalWeight &&
    scores.resolved / totalWeight >= policy.dominanceRatio &&
    resolvedOpposition < policy.meaningfulOppositionWeight
  ) {
    return 'LIKELY_RESOLVED';
  }

  const meaningfullyRepresentedPositions = [
    scores.support,
    scores.resolved,
    scores.dispute,
  ].filter((score) => score >= policy.meaningfulOppositionWeight).length;

  return meaningfullyRepresentedPositions >= 2 ? 'CONFLICTED' : 'UNVERIFIED';
}

export function evaluateCommunityEvidence(
  input: CommunityEvidenceEvaluationInput,
  policy: Readonly<CommunityEvidencePolicy> = BASELINE_V1_EVIDENCE_POLICY,
): CommunityEvidenceEvaluationResult {
  const activeFeedback = distinctActiveFeedback(input.feedbackEvents);
  const weightedScores: WeightedEvidenceScores = {
    support: 0,
    resolved: 0,
    dispute: 0,
  };
  let hasExpiredDirectionalEvidence = false;

  for (const event of activeFeedback) {
    if (!isDirectionalResponse(event.response)) continue;

    const ageMs = input.evaluatedAt.getTime() - event.createdAt.getTime();
    if (ageMs < 0) continue;
    if (ageMs >= policy.staleAfterMs) {
      hasExpiredDirectionalEvidence = true;
      continue;
    }

    const weight = baselineWeight(event.weightBasis);
    if (event.response === 'SUPPORT') weightedScores.support += weight;
    if (event.response === 'RESOLVED') weightedScores.resolved += weight;
    if (event.response === 'DISPUTE') weightedScores.dispute += weight;
  }

  const communityState = deriveCommunityState(
    weightedScores,
    hasExpiredDirectionalEvidence,
    policy,
  );
  const transition = planIncidentLifecycleTransition(input.lifecycle, {
    type: 'SET_COMMUNITY_STATE',
    communityState,
  });

  return {
    communityState,
    supportCount: weightedScores.support,
    activeFeedbackCount: activeFeedback.length,
    contributingFeedbackCount:
      weightedScores.support + weightedScores.resolved + weightedScores.dispute,
    weightedScores,
    evidenceRevision: input.currentEvidenceRevision + 1,
    lifecycle: transition.next,
    legacyStatus: transition.legacyStatus,
  };
}
