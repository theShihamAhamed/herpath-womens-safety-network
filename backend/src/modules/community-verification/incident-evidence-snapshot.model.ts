import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

import {
  INCIDENT_COMMUNITY_STATES,
  type IncidentCommunityState,
} from '../incidents/incident.types.js';
import {
  COMMUNITY_EVIDENCE_ALGORITHM_VERSIONS,
  type CommunityEvidenceAlgorithmVersion,
  type DirectionalFeedbackCounts,
  type FeedbackResponseCounts,
  type WeightedEvidenceScores,
} from './community-verification.types.js';

export interface IncidentEvidenceSnapshotDocumentFields {
  _id: Types.ObjectId;
  incidentId: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

export type IncidentEvidenceSnapshotDocument =
  HydratedDocument<IncidentEvidenceSnapshotDocumentFields>;

const nonNegativeInteger = {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: Number.isInteger,
    message: 'Evidence count must be an integer',
  },
} as const;

const nonNegativeScore = {
  type: Number,
  required: true,
  min: 0,
} as const;

const activeCountsSchema = new Schema<FeedbackResponseCounts>(
  {
    support: nonNegativeInteger,
    resolved: nonNegativeInteger,
    dispute: nonNegativeInteger,
    unsure: nonNegativeInteger,
  },
  { _id: false },
);

const directionalCountsSchema = new Schema<DirectionalFeedbackCounts>(
  {
    support: nonNegativeInteger,
    resolved: nonNegativeInteger,
    dispute: nonNegativeInteger,
  },
  { _id: false },
);

const weightedScoresSchema = new Schema<WeightedEvidenceScores>(
  {
    support: nonNegativeScore,
    resolved: nonNegativeScore,
    dispute: nonNegativeScore,
  },
  { _id: false },
);

const incidentEvidenceSnapshotSchema = new Schema<
  IncidentEvidenceSnapshotDocumentFields,
  Model<IncidentEvidenceSnapshotDocumentFields>
>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
    },
    algorithmVersion: {
      type: String,
      enum: COMMUNITY_EVIDENCE_ALGORITHM_VERSIONS,
      required: true,
      default: 'COMMUNITY_EVIDENCE_V1',
    },
    activeCounts: { type: activeCountsSchema, required: true },
    contributingCounts: { type: directionalCountsSchema, required: true },
    weightedScores: { type: weightedScoresSchema, required: true },
    contributingFeedbackCount: nonNegativeInteger,
    communityState: {
      type: String,
      enum: INCIDENT_COMMUNITY_STATES,
      required: true,
    },
    supportCount: nonNegativeInteger,
    evidenceRevision: nonNegativeInteger,
    evaluatedAt: { type: Date, required: true },
    nextEvaluationAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

incidentEvidenceSnapshotSchema.index({ incidentId: 1 }, { unique: true });
incidentEvidenceSnapshotSchema.index({ nextEvaluationAt: 1 });

incidentEvidenceSnapshotSchema.pre('validate', function validateAggregateConsistency() {
  if (this.supportCount !== this.contributingCounts.support) {
    this.invalidate('supportCount', 'Support count must match contributing support evidence');
  }

  const contributingTotal =
    this.contributingCounts.support +
    this.contributingCounts.resolved +
    this.contributingCounts.dispute;

  if (this.contributingFeedbackCount !== contributingTotal) {
    this.invalidate(
      'contributingFeedbackCount',
      'Contributing feedback count must match the directional evidence total',
    );
  }
});

export const IncidentEvidenceSnapshotModel = model<IncidentEvidenceSnapshotDocumentFields>(
  'IncidentEvidenceSnapshot',
  incidentEvidenceSnapshotSchema,
);
