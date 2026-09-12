import type { IncidentCommunityState } from '../incidents/incident.types.js';

export const FEEDBACK_RESPONSES = ['SUPPORT', 'RESOLVED', 'DISPUTE', 'UNSURE'] as const;

export const FEEDBACK_EVENT_STATES = ['ACTIVE', 'SUPERSEDED', 'WITHDRAWN'] as const;

export const WEIGHT_BASES = ['BASELINE_V1'] as const;

export const COMMUNITY_EVIDENCE_ALGORITHM_VERSIONS = ['COMMUNITY_EVIDENCE_V1'] as const;

export type FeedbackResponse = (typeof FEEDBACK_RESPONSES)[number];
export type FeedbackEventState = (typeof FEEDBACK_EVENT_STATES)[number];
export type WeightBasis = (typeof WEIGHT_BASES)[number];
export type CommunityEvidenceAlgorithmVersion =
  (typeof COMMUNITY_EVIDENCE_ALGORITHM_VERSIONS)[number];

export interface FeedbackResponseCounts {
  support: number;
  resolved: number;
  dispute: number;
  unsure: number;
}

export interface DirectionalFeedbackCounts {
  support: number;
  resolved: number;
  dispute: number;
}

export interface WeightedEvidenceScores {
  support: number;
  resolved: number;
  dispute: number;
}

export interface CreateIncidentFeedbackPersistenceInput {
  incidentId: string;
  actorId: string;
  clientFeedbackId: string;
  response: FeedbackResponse;
  evidenceWeight?: number;
  weightBasis?: WeightBasis;
  supersedesFeedbackId?: string;
}

export interface IncidentEvidenceSnapshotPersistenceInput {
  incidentId: string;
  algorithmVersion: CommunityEvidenceAlgorithmVersion;
  activeCounts: FeedbackResponseCounts;
  contributingCounts: DirectionalFeedbackCounts;
  weightedScores: WeightedEvidenceScores;
  contributingFeedbackCount: number;
  communityState: IncidentCommunityState;
  supportCount: number;
  evidenceRevision: number;
  evaluatedAt: Date;
  nextEvaluationAt: Date | null;
}
