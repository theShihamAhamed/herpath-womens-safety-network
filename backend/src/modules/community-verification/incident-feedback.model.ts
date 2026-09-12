import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

import {
  FEEDBACK_EVENT_STATES,
  FEEDBACK_RESPONSES,
  WEIGHT_BASES,
  type FeedbackEventState,
  type FeedbackResponse,
  type WeightBasis,
} from './community-verification.types.js';

export interface IncidentFeedbackDocumentFields {
  _id: Types.ObjectId;
  incidentId: Types.ObjectId;
  actorId: Types.ObjectId;
  clientFeedbackId: string;
  response: FeedbackResponse;
  state: FeedbackEventState;
  evidenceWeight: number;
  weightBasis: WeightBasis;
  supersedesFeedbackId?: Types.ObjectId;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IncidentFeedbackDocument = HydratedDocument<IncidentFeedbackDocumentFields>;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const incidentFeedbackSchema = new Schema<
  IncidentFeedbackDocumentFields,
  Model<IncidentFeedbackDocumentFields>
>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
    },
    clientFeedbackId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 36,
      maxlength: 36,
      match: UUID_V4,
      select: false,
    },
    response: { type: String, enum: FEEDBACK_RESPONSES, required: true },
    state: {
      type: String,
      enum: FEEDBACK_EVENT_STATES,
      required: true,
      default: 'ACTIVE',
    },
    evidenceWeight: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    weightBasis: {
      type: String,
      enum: WEIGHT_BASES,
      required: true,
      default: 'BASELINE_V1',
    },
    supersedesFeedbackId: {
      type: Schema.Types.ObjectId,
      ref: 'IncidentFeedback',
    },
    withdrawnAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

incidentFeedbackSchema.index({ actorId: 1, clientFeedbackId: 1 }, { unique: true });
incidentFeedbackSchema.index(
  { incidentId: 1, actorId: 1 },
  { unique: true, partialFilterExpression: { state: 'ACTIVE' } },
);
incidentFeedbackSchema.index({ incidentId: 1, state: 1, createdAt: -1 });
incidentFeedbackSchema.index({ actorId: 1, incidentId: 1, createdAt: -1 });

incidentFeedbackSchema.pre('validate', function validateServerControlledState() {
  if (this.weightBasis === 'BASELINE_V1' && this.evidenceWeight !== 1) {
    this.invalidate('evidenceWeight', 'BASELINE_V1 feedback must have an evidence weight of 1');
  }

  if (this.state === 'WITHDRAWN' && !this.withdrawnAt) {
    this.invalidate('withdrawnAt', 'Withdrawn feedback requires a withdrawal timestamp');
  }

  if (this.state !== 'WITHDRAWN' && this.withdrawnAt) {
    this.invalidate('withdrawnAt', 'Only withdrawn feedback may have a withdrawal timestamp');
  }
});

export const IncidentFeedbackModel = model<IncidentFeedbackDocumentFields>(
  'IncidentFeedback',
  incidentFeedbackSchema,
);
