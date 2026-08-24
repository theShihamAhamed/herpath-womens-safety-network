import { Types, type ClientSession } from 'mongoose';

import type {
  CreateIncidentFeedbackPersistenceInput,
  IncidentEvidenceSnapshotPersistenceInput,
} from './community-verification.types.js';
import {
  IncidentEvidenceSnapshotModel,
  type IncidentEvidenceSnapshotDocument,
} from './incident-evidence-snapshot.model.js';
import {
  IncidentFeedbackModel,
  type IncidentFeedbackDocument,
} from './incident-feedback.model.js';

export class CommunityVerificationRepository {
  public async createFeedback(
    input: CreateIncidentFeedbackPersistenceInput,
    session?: ClientSession,
  ): Promise<IncidentFeedbackDocument> {
    const feedback = new IncidentFeedbackModel({
      incidentId: new Types.ObjectId(input.incidentId),
      actorId: new Types.ObjectId(input.actorId),
      clientFeedbackId: input.clientFeedbackId,
      response: input.response,
      state: 'ACTIVE',
      evidenceWeight: input.evidenceWeight ?? 1,
      weightBasis: input.weightBasis ?? 'BASELINE_V1',
      withdrawnAt: null,
      ...(input.supersedesFeedbackId === undefined
        ? {}
        : { supersedesFeedbackId: new Types.ObjectId(input.supersedesFeedbackId) }),
    });

    return feedback.save(session === undefined ? {} : { session });
  }

  public async findByIdempotencyKey(
    actorId: string,
    clientFeedbackId: string,
    session?: ClientSession,
  ): Promise<IncidentFeedbackDocument | null> {
    return IncidentFeedbackModel.findOne({
      actorId: new Types.ObjectId(actorId),
      clientFeedbackId,
    })
      .select('+actorId +clientFeedbackId')
      .session(session ?? null)
      .exec();
  }

  public async findActiveForActor(
    incidentId: string,
    actorId: string,
    session?: ClientSession,
  ): Promise<IncidentFeedbackDocument | null> {
    return IncidentFeedbackModel.findOne({
      incidentId: new Types.ObjectId(incidentId),
      actorId: new Types.ObjectId(actorId),
      state: 'ACTIVE',
    })
      .select('+actorId +clientFeedbackId')
      .session(session ?? null)
      .exec();
  }

  public async findActiveForIncident(
    incidentId: string,
    session?: ClientSession,
  ): Promise<IncidentFeedbackDocument[]> {
    return IncidentFeedbackModel.find({
      incidentId: new Types.ObjectId(incidentId),
      state: 'ACTIVE',
    })
      .select('+actorId +clientFeedbackId')
      .sort({ createdAt: 1, _id: 1 })
      .session(session ?? null)
      .exec();
  }

  public async findSnapshot(
    incidentId: string,
    session?: ClientSession,
  ): Promise<IncidentEvidenceSnapshotDocument | null> {
    return IncidentEvidenceSnapshotModel.findOne({
      incidentId: new Types.ObjectId(incidentId),
    })
      .session(session ?? null)
      .exec();
  }

  public async upsertSnapshot(
    input: IncidentEvidenceSnapshotPersistenceInput,
    session?: ClientSession,
  ): Promise<IncidentEvidenceSnapshotDocument> {
    const incidentId = new Types.ObjectId(input.incidentId);
    const existing = await IncidentEvidenceSnapshotModel.findOne({ incidentId })
      .session(session ?? null)
      .exec();
    const snapshot =
      existing ??
      new IncidentEvidenceSnapshotModel({
        incidentId,
      });

    snapshot.set({
      algorithmVersion: input.algorithmVersion,
      activeCounts: input.activeCounts,
      contributingCounts: input.contributingCounts,
      weightedScores: input.weightedScores,
      contributingFeedbackCount: input.contributingFeedbackCount,
      communityState: input.communityState,
      supportCount: input.supportCount,
      evidenceRevision: input.evidenceRevision,
      evaluatedAt: input.evaluatedAt,
      nextEvaluationAt: input.nextEvaluationAt,
    });

    return snapshot.save(session === undefined ? {} : { session });
  }
}
