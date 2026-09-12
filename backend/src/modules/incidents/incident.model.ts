import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

import {
  INCIDENT_CATEGORIES,
  INCIDENT_COMMUNITY_STATES,
  INCIDENT_LOCATION_MODES,
  INCIDENT_MODERATION_STATES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_VISIBILITY_STATES,
  type GeoJsonPoint,
  type IncidentCategory,
  type IncidentCommunityState,
  type IncidentLocationMode,
  type IncidentModerationState,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentVisibilityState,
} from './incident.types.js';
import { deriveLegacyIncidentStatus } from './incident-lifecycle.service.js';
import {
  exactPointToPublicCell,
  publicPointFromCell,
  validateResolution8Cell,
} from './location-privacy.service.js';

export interface IncidentDocumentFields {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  clientSubmissionId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  occurredAt: Date;
  description?: string;
  status: IncidentStatus;
  supportCount: number;
  visibilityState: IncidentVisibilityState;
  communityState: IncidentCommunityState;
  moderationState: IncidentModerationState;
  lifecycleRevision: number;
  locationMode: IncidentLocationMode;
  privateLocation: GeoJsonPoint | null;
  publicCellId: string;
  publicLocation: GeoJsonPoint;
  createdAt: Date;
  updatedAt: Date;
}

export type IncidentDocument = HydratedDocument<IncidentDocumentFields>;

function coordinatesAreValid(coordinates: number[]): boolean {
  if (coordinates.length !== 2) return false;
  const [longitude, latitude] = coordinates;
  return (
    longitude !== undefined &&
    latitude !== undefined &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

const pointSchema = new Schema<GeoJsonPoint>(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: coordinatesAreValid,
        message: 'GeoJSON Point coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false },
);

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const incidentSchema = new Schema<IncidentDocumentFields, Model<IncidentDocumentFields>>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
    },
    clientSubmissionId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 36,
      maxlength: 36,
      match: UUID_SHAPE,
      select: false,
    },
    category: { type: String, enum: INCIDENT_CATEGORIES, required: true },
    severity: { type: String, enum: INCIDENT_SEVERITIES, required: true },
    occurredAt: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      required: true,
      default: 'PUBLISHED_UNVERIFIED',
    },
    supportCount: { type: Number, required: true, default: 0, min: 0 },
    visibilityState: {
      type: String,
      enum: INCIDENT_VISIBILITY_STATES,
      required: true,
      default: 'PUBLIC',
    },
    communityState: {
      type: String,
      enum: INCIDENT_COMMUNITY_STATES,
      required: true,
      default: 'UNVERIFIED',
    },
    moderationState: {
      type: String,
      enum: INCIDENT_MODERATION_STATES,
      required: true,
      default: 'NOT_QUEUED',
    },
    lifecycleRevision: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Lifecycle revision must be an integer',
      },
    },
    locationMode: { type: String, enum: INCIDENT_LOCATION_MODES, required: true },
    privateLocation: { type: pointSchema, default: null, select: false },
    publicCellId: { type: String, required: true, select: false },
    publicLocation: { type: pointSchema, required: true },
  },
  { timestamps: true, versionKey: false },
);

incidentSchema.index({ reporterId: 1, clientSubmissionId: 1 }, { unique: true });
incidentSchema.index({ reporterId: 1, createdAt: -1, _id: -1 });
incidentSchema.index({ publicLocation: '2dsphere' });

function pointsMatch(left: GeoJsonPoint, right: GeoJsonPoint): boolean {
  return (
    left.type === right.type &&
    left.coordinates[0] === right.coordinates[0] &&
    left.coordinates[1] === right.coordinates[1]
  );
}

incidentSchema.pre('validate', function enforceLocationPrivacy() {
  if (this.locationMode === 'EXACT_PRIVATE' && !this.privateLocation) {
    this.invalidate('privateLocation', 'Exact-private incidents require a private location');
    return;
  }

  if (this.locationMode === 'APPROXIMATE_ONLY' && this.privateLocation) {
    this.invalidate('privateLocation', 'Approximate-only incidents cannot store a private location');
    return;
  }

  try {
    const validatedCellId = validateResolution8Cell(this.publicCellId);
    const expectedPublicLocation = publicPointFromCell(validatedCellId);

    if (!pointsMatch(this.publicLocation, expectedPublicLocation)) {
      this.invalidate('publicLocation', 'Public location must be the center of the public H3 cell');
    }

    if (
      this.locationMode === 'EXACT_PRIVATE' &&
      this.privateLocation &&
      exactPointToPublicCell(this.privateLocation) !== validatedCellId
    ) {
      this.invalidate('publicCellId', 'Public H3 cell must be derived from the private location');
    }
  } catch (error) {
    this.invalidate(
      'publicCellId',
      error instanceof Error ? error.message : 'Public H3 cell is invalid',
    );
  }
});

incidentSchema.pre('validate', function enforceLifecycleConsistency() {
  if (!this.visibilityState || !this.communityState || !this.moderationState) return;

  const expectedStatus = deriveLegacyIncidentStatus({
    visibilityState: this.visibilityState,
    communityState: this.communityState,
    moderationState: this.moderationState,
  });

  if (this.status !== expectedStatus) {
    this.invalidate('status', 'Status must match the derived incident lifecycle status');
  }
});

export const IncidentModel = model<IncidentDocumentFields>('Incident', incidentSchema);
