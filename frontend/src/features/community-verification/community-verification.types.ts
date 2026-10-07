export const FEEDBACK_RESPONSES = ['SUPPORT', 'RESOLVED', 'DISPUTE', 'UNSURE'] as const;

export type FeedbackResponse = (typeof FEEDBACK_RESPONSES)[number];

export const INCIDENT_FLAG_REASONS = [
  'INACCURATE',
  'SPAM',
  'DUPLICATE',
  'HARMFUL_CONTENT',
  'PRIVACY_VIOLATION',
  'MISLEADING',
  'OTHER',
] as const;

export type IncidentFlagReason = (typeof INCIDENT_FLAG_REASONS)[number];

export type CommunityState = 'UNVERIFIED' | 'SUPPORTED' | 'CONFLICTED' | 'LIKELY_RESOLVED';

/** Only the public aggregate fields used by the community panel. */
export interface CommunityEvidence {
  communityState: CommunityState;
  supportCount: number;
  activeFeedbackCount: number;
  contributingFeedbackCount: number;
  evaluatedAt: string;
}

export interface CommunityFeedback {
  response: FeedbackResponse;
  submittedAt: string;
  contributesUntil: string;
}

export interface CommunityVerificationStatus {
  evidence: CommunityEvidence;
  myFeedback: CommunityFeedback | null;
}

export type FeedbackEligibilityReason =
  | 'ELIGIBLE'
  | 'AUTHENTICATION_REQUIRED'
  | 'INCIDENT_NOT_FOUND'
  | 'INCIDENT_NOT_PUBLIC'
  | 'OWN_REPORT'
  | 'COOLDOWN_ACTIVE';

export interface FeedbackEligibility {
  canSubmit: boolean;
  canReplace: boolean;
  reason: FeedbackEligibilityReason;
  nextEligibleAt: string | null;
  currentResponse: FeedbackResponse | null;
  eligibilityBasis: 'AUTHENTICATED_ACTOR_V1';
}

export interface SubmitFeedbackInput {
  clientFeedbackId: string;
  response: FeedbackResponse;
}

export interface SubmitFlagInput {
  clientFlagId: string;
  reason: IncidentFlagReason;
  details?: string;
}

export interface IncidentFlag {
  id: string;
  incidentId: string;
  reason: IncidentFlagReason;
  details?: string;
  submittedAt: string;
}

export interface CommunityIncidentChange {
  incidentId: string;
  evidence: CommunityEvidence;
}
