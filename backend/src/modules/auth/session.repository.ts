import { Types } from 'mongoose';

import {
  SessionModel,
  type SessionDocument,
  type SessionRevocationReason,
} from './session.model.js';

export class SessionRepository {
  public async create(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<SessionDocument> {
    return SessionModel.create({
      userId: new Types.ObjectId(input.userId),
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
    });
  }

  public async findByRefreshTokenHash(hash: string): Promise<SessionDocument | null> {
    return SessionModel.findOne({ refreshTokenHash: hash }).select('+refreshTokenHash').exec();
  }

  public async findActiveById(id: string, now = new Date()): Promise<SessionDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return SessionModel.findOne({ _id: id, revokedAt: null, expiresAt: { $gt: now } }).exec();
  }

  public async rotateIfActive(
    sessionId: string,
    replacementSessionId: string,
    now = new Date(),
  ): Promise<boolean> {
    const result = await SessionModel.updateOne(
      { _id: sessionId, revokedAt: null, expiresAt: { $gt: now } },
      {
        $set: {
          revokedAt: now,
          revokeReason: 'ROTATED',
          replacedBySessionId: new Types.ObjectId(replacementSessionId),
        },
      },
    ).exec();
    return result.modifiedCount === 1;
  }

  public async revokeById(
    id: string,
    reason: SessionRevocationReason,
    now = new Date(),
  ): Promise<void> {
    await SessionModel.updateOne(
      { _id: id, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } },
    ).exec();
  }

  public async revokeByRefreshTokenHash(
    hash: string,
    reason: SessionRevocationReason,
    now = new Date(),
  ): Promise<void> {
    await SessionModel.updateOne(
      { refreshTokenHash: hash, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } },
    ).exec();
  }

  public async revokeAllActiveForUser(
    userId: string,
    reason: SessionRevocationReason,
    now = new Date(),
  ): Promise<void> {
    await SessionModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } },
    ).exec();
  }
}
