import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

import {
  INCIDENT_FLAG_REASONS,
  MODERATION_CASE_SOURCES,
  MODERATION_CASE_STATES,
  MODERATION_PRIORITIES,
  MODERATION_PRIORITY_RANKS,
  MODERATION_RESOLUTIONS,
  type IncidentFlagReasonCounts,
  type ModerationCaseSource,
  type ModerationCaseState,
  type ModerationPriority,
  type ModerationResolution,
} from './moderation.types.js';

export interface ModerationCaseDocumentFields {
  _id: Types.ObjectId;
  incidentId: Types.ObjectId;
  sources: ModerationCaseSource[];
  state: ModerationCaseState;
  priority: ModerationPriority;
  priorityRank: number;
  assignedModeratorId: Types.ObjectId | null;
  flagCount: number;
  reasonCounts: IncidentFlagReasonCounts;
  resolution: ModerationResolution | null;
  resolutionReason: string | null;
  relatedIncidentId: Types.ObjectId | null;
  caseRevision: number;
  queuedAt: Date;
  reviewStartedAt: Date | null;
  resolvedAt: Date | null;
  latestActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ModerationCaseDocument = HydratedDocument<ModerationCaseDocumentFields>;

const nonNegativeInteger = {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: Number.isInteger,
    message: 'Value must be a non-negative integer',
  },
} as const;

const reasonCountsDefinition = Object.fromEntries(
  INCIDENT_FLAG_REASONS.map((reason) => [reason, { ...nonNegativeInteger, default: 0 }]),
) as Record<(typeof INCIDENT_FLAG_REASONS)[number], typeof nonNegativeInteger & { default: number }>;

const reasonCountsSchema = new Schema<IncidentFlagReasonCounts>(reasonCountsDefinition, {
  _id: false,
});

const moderationCaseSchema = new Schema<
  ModerationCaseDocumentFields,
  Model<ModerationCaseDocumentFields>
>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
      immutable: true,
    },
    sources: {
      type: [{ type: String, enum: MODERATION_CASE_SOURCES }],
      required: true,
      validate: {
        validator: (sources: ModerationCaseSource[]) =>
          sources.length > 0 && new Set(sources).size === sources.length,
        message: 'Moderation case sources must be non-empty and unique',
      },
    },
    state: {
      type: String,
      enum: MODERATION_CASE_STATES,
      required: true,
      default: 'QUEUED',
    },
    priority: {
      type: String,
      enum: MODERATION_PRIORITIES,
      required: true,
      default: 'NORMAL',
    },
    priorityRank: {
      type: Number,
      required: true,
      enum: Object.values(MODERATION_PRIORITY_RANKS),
      default: MODERATION_PRIORITY_RANKS.NORMAL,
    },
    assignedModeratorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      select: false,
    },
    flagCount: { ...nonNegativeInteger, default: 0 },
    reasonCounts: { type: reasonCountsSchema, required: true },
    resolution: {
      type: String,
      enum: [...MODERATION_RESOLUTIONS, null],
      default: null,
    },
    resolutionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
      select: false,
    },
    relatedIncidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
    },
    caseRevision: { ...nonNegativeInteger, default: 0 },
    queuedAt: { type: Date, required: true },
    reviewStartedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    latestActivityAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

moderationCaseSchema.index({ incidentId: 1 }, { unique: true });
moderationCaseSchema.index({ state: 1, priorityRank: -1, latestActivityAt: -1, _id: -1 });
moderationCaseSchema.index({ assignedModeratorId: 1, state: 1, latestActivityAt: -1 });

moderationCaseSchema.pre('validate', function validateCaseConsistency() {
  if (this.priorityRank !== MODERATION_PRIORITY_RANKS[this.priority]) {
    this.invalidate('priorityRank', 'Priority rank must match the moderation priority');
  }

  const countedFlags = INCIDENT_FLAG_REASONS.reduce(
    (total, reason) => total + this.reasonCounts[reason],
    0,
  );
  if (this.flagCount !== countedFlags) {
    this.invalidate('flagCount', 'Flag count must match the sum of reason counts');
  }

  const hasResolutionData =
    this.resolution !== null ||
    this.resolutionReason !== null ||
    this.relatedIncidentId !== null ||
    this.resolvedAt !== null;

  if (this.state === 'QUEUED' && (this.assignedModeratorId !== null || hasResolutionData)) {
    this.invalidate('state', 'Queued cases cannot be assigned or resolved');
  }

  if (this.state === 'IN_REVIEW') {
    if (this.assignedModeratorId === null) {
      this.invalidate('assignedModeratorId', 'Cases in review require an assigned moderator');
    }
    if (hasResolutionData) {
      this.invalidate('state', 'Cases in review cannot contain resolution data');
    }
  }

  if (this.state === 'RESOLVED') {
    if (this.assignedModeratorId === null) {
      this.invalidate('assignedModeratorId', 'Resolved cases require an assigned moderator');
    }
    if (this.resolution === null || !this.resolutionReason || this.resolvedAt === null) {
      this.invalidate('resolution', 'Resolved cases require a resolution, reason, and timestamp');
    }
    if (this.resolution === 'ARCHIVED_DUPLICATE' && this.relatedIncidentId === null) {
      this.invalidate('relatedIncidentId', 'Duplicate resolutions require a related incident');
    }
    if (this.resolution !== 'ARCHIVED_DUPLICATE' && this.relatedIncidentId !== null) {
      this.invalidate('relatedIncidentId', 'Only duplicate resolutions may reference an incident');
    }
  }
});

export const ModerationCaseModel = model<ModerationCaseDocumentFields>(
  'ModerationCase',
  moderationCaseSchema,
);
