import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

import {
  INCIDENT_COMMUNITY_STATES,
  INCIDENT_MODERATION_STATES,
  INCIDENT_STATUSES,
  INCIDENT_VISIBILITY_STATES,
} from '../incidents/incident.types.js';
import {
  MODERATION_AUDIT_ACTIONS,
  MODERATION_AUDIT_ACTOR_TYPES,
  MODERATION_CASE_STATES,
  MODERATION_PRIORITIES,
  type IncidentLifecycleAuditSnapshot,
  type ModerationAuditAction,
  type ModerationAuditActorType,
  type ModerationCaseAuditSnapshot,
} from './moderation.types.js';

export interface ModerationAuditLogDocumentFields {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  incidentId: Types.ObjectId;
  actorType: ModerationAuditActorType;
  moderatorId: Types.ObjectId | null;
  clientActionId: string | null;
  action: ModerationAuditAction;
  reason: string;
  previousCaseState: ModerationCaseAuditSnapshot | null;
  newCaseState: ModerationCaseAuditSnapshot;
  previousIncidentLifecycle: IncidentLifecycleAuditSnapshot;
  newIncidentLifecycle: IncidentLifecycleAuditSnapshot;
  triggerFlagId: Types.ObjectId | null;
  relatedIncidentId: Types.ObjectId | null;
  requestId: string | null;
  createdAt: Date;
}

export type ModerationAuditLogDocument = HydratedDocument<ModerationAuditLogDocumentFields>;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const nonNegativeInteger = {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: Number.isInteger,
    message: 'Revision must be a non-negative integer',
  },
} as const;

const caseSnapshotSchema = new Schema<ModerationCaseAuditSnapshot>(
  {
    state: { type: String, enum: MODERATION_CASE_STATES, required: true },
    priority: { type: String, enum: MODERATION_PRIORITIES, required: true },
    caseRevision: nonNegativeInteger,
  },
  { _id: false },
);

const incidentLifecycleSnapshotSchema = new Schema<IncidentLifecycleAuditSnapshot>(
  {
    visibilityState: { type: String, enum: INCIDENT_VISIBILITY_STATES, required: true },
    communityState: { type: String, enum: INCIDENT_COMMUNITY_STATES, required: true },
    moderationState: { type: String, enum: INCIDENT_MODERATION_STATES, required: true },
    lifecycleRevision: nonNegativeInteger,
    status: { type: String, enum: INCIDENT_STATUSES, required: true },
  },
  { _id: false },
);

const moderationAuditLogSchema = new Schema<
  ModerationAuditLogDocumentFields,
  Model<ModerationAuditLogDocumentFields>
>(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      ref: 'ModerationCase',
      required: true,
      immutable: true,
    },
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
      immutable: true,
    },
    actorType: {
      type: String,
      enum: MODERATION_AUDIT_ACTOR_TYPES,
      required: true,
      immutable: true,
    },
    moderatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      immutable: true,
      select: false,
    },
    clientActionId: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 36,
      maxlength: 36,
      match: UUID_V4,
      default: null,
      immutable: true,
      select: false,
    },
    action: {
      type: String,
      enum: MODERATION_AUDIT_ACTIONS,
      required: true,
      immutable: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
      immutable: true,
      select: false,
    },
    previousCaseState: {
      type: caseSnapshotSchema,
      default: null,
      immutable: true,
    },
    newCaseState: {
      type: caseSnapshotSchema,
      required: true,
      immutable: true,
    },
    previousIncidentLifecycle: {
      type: incidentLifecycleSnapshotSchema,
      required: true,
      immutable: true,
    },
    newIncidentLifecycle: {
      type: incidentLifecycleSnapshotSchema,
      required: true,
      immutable: true,
    },
    triggerFlagId: {
      type: Schema.Types.ObjectId,
      ref: 'IncidentFlag',
      default: null,
      immutable: true,
    },
    relatedIncidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
      immutable: true,
    },
    requestId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
      immutable: true,
      select: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

moderationAuditLogSchema.index({ caseId: 1, createdAt: 1, _id: 1 });
moderationAuditLogSchema.index({ incidentId: 1, createdAt: 1, _id: 1 });
moderationAuditLogSchema.index({ moderatorId: 1, createdAt: -1, _id: -1 });
moderationAuditLogSchema.index(
  { moderatorId: 1, clientActionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      actorType: 'MODERATOR',
      clientActionId: { $type: 'string' },
    },
  },
);

moderationAuditLogSchema.pre('validate', function validateAuditActor() {
  if (this.actorType === 'MODERATOR') {
    if (this.moderatorId === null || this.clientActionId === null) {
      this.invalidate(
        'moderatorId',
        'Moderator audit entries require a moderator and client action ID',
      );
    }
  } else if (this.moderatorId !== null || this.clientActionId !== null) {
    this.invalidate('actorType', 'System audit entries cannot contain moderator identity');
  }
});

moderationAuditLogSchema.pre('save', function preventAuditResave() {
  if (!this.isNew) {
    throw new Error('Moderation audit logs are append-only');
  }
});

const appendOnlyOperations = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const;

for (const operation of appendOnlyOperations) {
  moderationAuditLogSchema.pre(operation, function preventAuditMutation() {
    throw new Error('Moderation audit logs are append-only');
  });
}

export const ModerationAuditLogModel = model<ModerationAuditLogDocumentFields>(
  'ModerationAuditLog',
  moderationAuditLogSchema,
);
