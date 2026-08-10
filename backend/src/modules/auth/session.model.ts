import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const SESSION_REVOCATION_REASONS = [
  'LOGOUT',
  'ROTATED',
  'REUSE_DETECTED',
  'ACCOUNT_DISABLED',
] as const;
export type SessionRevocationReason = (typeof SESSION_REVOCATION_REASONS)[number];

export interface SessionDocumentFields {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason?: SessionRevocationReason;
  replacedBySessionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<SessionDocumentFields>;

const sessionSchema = new Schema<SessionDocumentFields, Model<SessionDocumentFields>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, enum: SESSION_REVOCATION_REASONS },
    replacedBySessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
  },
  { timestamps: true, versionKey: false },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<SessionDocumentFields>('Session', sessionSchema);
