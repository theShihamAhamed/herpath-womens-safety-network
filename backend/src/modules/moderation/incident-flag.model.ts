import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

import { INCIDENT_FLAG_REASONS, type IncidentFlagReason } from './moderation.types.js';

export interface IncidentFlagDocumentFields {
  _id: Types.ObjectId;
  incidentId: Types.ObjectId;
  actorId: Types.ObjectId;
  clientFlagId: string;
  reason: IncidentFlagReason;
  details?: string;
  createdAt: Date;
}

export type IncidentFlagDocument = HydratedDocument<IncidentFlagDocumentFields>;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const incidentFlagSchema = new Schema<IncidentFlagDocumentFields, Model<IncidentFlagDocumentFields>>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
      immutable: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      select: false,
    },
    clientFlagId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 36,
      maxlength: 36,
      match: UUID_V4,
      immutable: true,
      select: false,
    },
    reason: {
      type: String,
      enum: INCIDENT_FLAG_REASONS,
      required: true,
      immutable: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 500,
      immutable: true,
      select: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

incidentFlagSchema.index({ actorId: 1, clientFlagId: 1 }, { unique: true });
incidentFlagSchema.index({ incidentId: 1, actorId: 1 }, { unique: true });
incidentFlagSchema.index({ incidentId: 1, reason: 1, createdAt: -1, _id: -1 });

incidentFlagSchema.pre('save', function preventFlagResave() {
  if (!this.isNew) {
    throw new Error('Incident flags are immutable');
  }
});

const immutableFlagOperations = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const;

for (const operation of immutableFlagOperations) {
  incidentFlagSchema.pre(operation, function preventFlagMutation() {
    throw new Error('Incident flags are immutable');
  });
}

export const IncidentFlagModel = model<IncidentFlagDocumentFields>(
  'IncidentFlag',
  incidentFlagSchema,
);
