import { Schema, model, Document, Types } from 'mongoose';
import { JourneyOutcome, JourneyStatus } from './journey.types.js';

export interface IJourney extends Document {
  userId: Types.ObjectId;
  routeId: string;
  origin: { latitude: number; longitude: number; address?: string };
  destination: { latitude: number; longitude: number; address?: string };
  selectedRoute: { polyline: string; distance?: number; duration?: number; riskScore?: number };
  startTime?: Date;
  endTime?: Date;
  distanceTravelled: number;
  duration: number;
  currentPath: { latitude: number; longitude: number; timestamp: Date }[];
  checkIns: { latitude: number; longitude: number; timestamp: Date }[];
  deviationDetected: boolean;
  deviationLocation: { latitude: number; longitude: number } | null;
  deviationTime: Date | null;
  outcome: JourneyOutcome | null;
  status: JourneyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CoordinateSchema = new Schema(
  { latitude: { type: Number, required: true }, longitude: { type: Number, required: true } },
  { _id: false }
);

const PathPointSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const JourneySchema = new Schema<IJourney>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    routeId: { type: String, required: true },
    origin: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: String,
    },
    destination: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: String,
    },
    selectedRoute: {
      polyline: { type: String, required: true },
      distance: Number,
      duration: Number,
      riskScore: Number,
    },
    startTime: Date,
    endTime: Date,
    distanceTravelled: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    currentPath: { type: [PathPointSchema], default: [] },
    checkIns: { type: [PathPointSchema], default: [] },
    deviationDetected: { type: Boolean, default: false },
    deviationLocation: { type: CoordinateSchema, default: null },
    deviationTime: { type: Date, default: null },
    outcome: {
      type: String,
      enum: ['SAFE_CONFIRMED', 'INCIDENT_REPORTED', 'UNKNOWN'],
      default: null,
    },
    status: { type: String, enum: ['ACTIVE', 'COMPLETED'], default: 'ACTIVE', index: true },
  },
  { timestamps: true }
);

export const Journey = model<IJourney>('Journey', JourneySchema);