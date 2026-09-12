import { Types, type ClientSession, type QueryFilter } from 'mongoose';

import {
  IncidentFlagModel,
  type IncidentFlagDocument,
} from './incident-flag.model.js';
import {
  ModerationAuditLogModel,
  type ModerationAuditLogDocument,
} from './moderation-audit.model.js';
import {
  ModerationCaseModel,
  type ModerationCaseDocument,
} from './moderation-case.model.js';
import {
  MODERATION_PRIORITY_RANKS,
  type CreateIncidentFlagPersistenceInput,
  type CreateModerationAuditPersistenceInput,
  type CreateModerationCasePersistenceInput,
  type ModerationCaseQueueCursor,
  type ModerationCaseQueueFilters,
  type ModerationCaseRevisionUpdate,
} from './moderation.types.js';

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

export class ModerationRepository {
  public async createFlag(
    input: CreateIncidentFlagPersistenceInput,
    session?: ClientSession,
  ): Promise<IncidentFlagDocument> {
    const flag = new IncidentFlagModel({
      incidentId: objectId(input.incidentId),
      actorId: objectId(input.actorId),
      clientFlagId: input.clientFlagId,
      reason: input.reason,
      ...(input.details === undefined ? {} : { details: input.details }),
    });

    return flag.save(session === undefined ? {} : { session });
  }

  public async findFlagByIdempotencyKey(
    actorId: string,
    clientFlagId: string,
    session?: ClientSession,
  ): Promise<IncidentFlagDocument | null> {
    return IncidentFlagModel.findOne({
      actorId: objectId(actorId),
      clientFlagId,
    })
      .select('+actorId +clientFlagId +details')
      .session(session ?? null)
      .exec();
  }

  public async findFlagForActorIncident(
    incidentId: string,
    actorId: string,
    session?: ClientSession,
  ): Promise<IncidentFlagDocument | null> {
    return IncidentFlagModel.findOne({
      incidentId: objectId(incidentId),
      actorId: objectId(actorId),
    })
      .select('+actorId +clientFlagId +details')
      .session(session ?? null)
      .exec();
  }

  public async findFlagsForIncident(
    incidentId: string,
    session?: ClientSession,
  ): Promise<IncidentFlagDocument[]> {
    return IncidentFlagModel.find({ incidentId: objectId(incidentId) })
      .select('+details')
      .sort({ createdAt: 1, _id: 1 })
      .session(session ?? null)
      .exec();
  }

  public async createCase(
    input: CreateModerationCasePersistenceInput,
    session?: ClientSession,
  ): Promise<ModerationCaseDocument> {
    const moderationCase = new ModerationCaseModel({
      incidentId: objectId(input.incidentId),
      sources: input.sources,
      state: 'QUEUED',
      priority: input.priority,
      priorityRank: MODERATION_PRIORITY_RANKS[input.priority],
      assignedModeratorId: null,
      flagCount: input.flagCount,
      reasonCounts: input.reasonCounts,
      resolution: null,
      resolutionReason: null,
      relatedIncidentId: null,
      caseRevision: 0,
      queuedAt: input.queuedAt,
      reviewStartedAt: null,
      resolvedAt: null,
      latestActivityAt: input.latestActivityAt,
    });

    return moderationCase.save(session === undefined ? {} : { session });
  }

  public async findCaseById(
    caseId: string,
    session?: ClientSession,
  ): Promise<ModerationCaseDocument | null> {
    return ModerationCaseModel.findById(objectId(caseId))
      .select('+assignedModeratorId +resolutionReason')
      .session(session ?? null)
      .exec();
  }

  public async findCaseByIncident(
    incidentId: string,
    session?: ClientSession,
  ): Promise<ModerationCaseDocument | null> {
    return ModerationCaseModel.findOne({ incidentId: objectId(incidentId) })
      .select('+assignedModeratorId +resolutionReason')
      .session(session ?? null)
      .exec();
  }

  public async findCasePage(
    filters: ModerationCaseQueueFilters,
    limit: number,
    cursor?: ModerationCaseQueueCursor,
    session?: ClientSession,
  ): Promise<ModerationCaseDocument[]> {
    const filter: QueryFilter<ModerationCaseDocument> = {
      ...(filters.state === undefined ? {} : { state: filters.state }),
      ...(filters.priority === undefined ? {} : { priority: filters.priority }),
      ...(filters.assignment === 'UNASSIGNED'
        ? { assignedModeratorId: null }
        : filters.assignment === 'MINE'
          ? { assignedModeratorId: objectId(filters.moderatorId) }
          : {}),
      ...(cursor === undefined
        ? {}
        : {
            $or: [
              { priorityRank: { $lt: cursor.priorityRank } },
              {
                priorityRank: cursor.priorityRank,
                latestActivityAt: { $lt: cursor.latestActivityAt },
              },
              {
                priorityRank: cursor.priorityRank,
                latestActivityAt: cursor.latestActivityAt,
                _id: { $lt: objectId(cursor.id) },
              },
            ],
          }),
    };

    return ModerationCaseModel.find(filter)
      .select('+assignedModeratorId')
      .sort({ priorityRank: -1, latestActivityAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }

  public async updateCaseWithRevision(
    caseId: string,
    expectedRevision: number,
    input: ModerationCaseRevisionUpdate,
    session?: ClientSession,
  ): Promise<ModerationCaseDocument | null> {
    return ModerationCaseModel.findOneAndUpdate(
      {
        _id: objectId(caseId),
        caseRevision: expectedRevision,
      },
      {
        $set: {
          sources: input.sources,
          state: input.state,
          priority: input.priority,
          priorityRank: MODERATION_PRIORITY_RANKS[input.priority],
          assignedModeratorId:
            input.assignedModeratorId === null ? null : objectId(input.assignedModeratorId),
          flagCount: input.flagCount,
          reasonCounts: input.reasonCounts,
          resolution: input.resolution,
          resolutionReason: input.resolutionReason,
          relatedIncidentId:
            input.relatedIncidentId === null ? null : objectId(input.relatedIncidentId),
          queuedAt: input.queuedAt,
          reviewStartedAt: input.reviewStartedAt,
          resolvedAt: input.resolvedAt,
          latestActivityAt: input.latestActivityAt,
        },
        $inc: { caseRevision: 1 },
      },
      {
        returnDocument: 'after',
        runValidators: true,
        session: session ?? null,
      },
    )
      .select('+assignedModeratorId +resolutionReason')
      .exec();
  }

  public async createAuditLog(
    input: CreateModerationAuditPersistenceInput,
    session?: ClientSession,
  ): Promise<ModerationAuditLogDocument> {
    const audit = new ModerationAuditLogModel({
      caseId: objectId(input.caseId),
      incidentId: objectId(input.incidentId),
      actorType: input.actorType,
      moderatorId: input.moderatorId === undefined ? null : objectId(input.moderatorId),
      clientActionId: input.clientActionId ?? null,
      action: input.action,
      reason: input.reason,
      previousCaseState: input.previousCaseState,
      newCaseState: input.newCaseState,
      previousIncidentLifecycle: input.previousIncidentLifecycle,
      newIncidentLifecycle: input.newIncidentLifecycle,
      triggerFlagId: input.triggerFlagId === undefined ? null : objectId(input.triggerFlagId),
      relatedIncidentId:
        input.relatedIncidentId === undefined ? null : objectId(input.relatedIncidentId),
      requestId: input.requestId ?? null,
    });

    return audit.save(session === undefined ? {} : { session });
  }

  public async findAuditByIdempotencyKey(
    moderatorId: string,
    clientActionId: string,
    session?: ClientSession,
  ): Promise<ModerationAuditLogDocument | null> {
    return ModerationAuditLogModel.findOne({
      moderatorId: objectId(moderatorId),
      clientActionId,
    })
      .select('+moderatorId +clientActionId +reason +requestId')
      .session(session ?? null)
      .exec();
  }

  public async findAuditLogsForCase(
    caseId: string,
    session?: ClientSession,
  ): Promise<ModerationAuditLogDocument[]> {
    return ModerationAuditLogModel.find({ caseId: objectId(caseId) })
      .sort({ createdAt: 1, _id: 1 })
      .session(session ?? null)
      .exec();
  }
}
