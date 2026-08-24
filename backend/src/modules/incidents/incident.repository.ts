import { Types, type ClientSession, type QueryFilter } from 'mongoose';

import {
  IncidentModel,
  type IncidentDocument,
  type IncidentDocumentFields,
} from './incident.model.js';
import {
  type PublicIncidentReadFilters,
  type PublicIncidentRadiusRead,
  type PublicIncidentViewportRead,
} from './incident.public.js';
import type {
  CreateIncidentPersistenceInput,
  OwnerIncidentCursor,
} from './incident.types.js';
import { normalizeIncidentLocation } from './location-privacy.service.js';

const PUBLIC_READ_PROJECTION =
  '_id category severity status occurredAt createdAt supportCount publicLocation +publicCellId visibilityState communityState moderationState lifecycleRevision';

function publicIncidentFilter(
  filters: PublicIncidentReadFilters,
): QueryFilter<IncidentDocumentFields> {
  const hasOccurredRange = filters.occurredFrom !== undefined || filters.occurredTo !== undefined;

  return {
    $or: [
      { visibilityState: 'PUBLIC' },
      {
        visibilityState: { $exists: false },
        communityState: { $exists: false },
        moderationState: { $exists: false },
        lifecycleRevision: { $exists: false },
        status: 'PUBLISHED_UNVERIFIED',
      },
    ],
    ...(filters.category === undefined ? {} : { category: filters.category }),
    ...(filters.severity === undefined ? {} : { severity: filters.severity }),
    ...(hasOccurredRange
      ? {
          occurredAt: {
            ...(filters.occurredFrom === undefined ? {} : { $gte: filters.occurredFrom }),
            ...(filters.occurredTo === undefined ? {} : { $lte: filters.occurredTo }),
          },
        }
      : {}),
  };
}

export class IncidentRepository {
  public async create(input: CreateIncidentPersistenceInput): Promise<IncidentDocument> {
    const location = normalizeIncidentLocation(input.location);
    const incident = {
      reporterId: new Types.ObjectId(input.reporterId),
      clientSubmissionId: input.clientSubmissionId,
      category: input.category,
      severity: input.severity,
      occurredAt: input.occurredAt,
      ...location,
      ...(input.description === undefined ? {} : { description: input.description }),
    };

    return IncidentModel.create(incident);
  }

  public async findByIdempotencyKey(
    reporterId: string,
    clientSubmissionId: string,
  ): Promise<IncidentDocument | null> {
    return IncidentModel.findOne({
      reporterId: new Types.ObjectId(reporterId),
      clientSubmissionId,
    })
      .select('+reporterId +clientSubmissionId +privateLocation +publicCellId')
      .exec();
  }

  public async findCommunityFeedbackTarget(
    incidentId: string,
    session?: ClientSession,
  ): Promise<IncidentDocument | null> {
    return IncidentModel.findById(new Types.ObjectId(incidentId))
      .select('+reporterId +privateLocation +publicCellId')
      .session(session ?? null)
      .exec();
  }

  public async saveCommunityEvidence(
    incident: IncidentDocument,
    input: {
      communityState: IncidentDocument['communityState'];
      status: IncidentDocument['status'];
      supportCount: number;
      lifecycleRevision: number;
    },
    session?: ClientSession,
  ): Promise<IncidentDocument> {
    incident.communityState = input.communityState;
    incident.status = input.status;
    incident.supportCount = input.supportCount;
    incident.lifecycleRevision = input.lifecycleRevision;
    return incident.save(session === undefined ? {} : { session });
  }

  public async findOwnedPage(
    reporterId: string,
    limit: number,
    cursor?: OwnerIncidentCursor,
  ): Promise<IncidentDocument[]> {
    const reporterObjectId = new Types.ObjectId(reporterId);
    const filter = cursor
      ? {
          reporterId: reporterObjectId,
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            {
              createdAt: cursor.createdAt,
              _id: { $lt: new Types.ObjectId(cursor.id) },
            },
          ],
        }
      : { reporterId: reporterObjectId };

    return IncidentModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).exec();
  }

  public async findPublicInViewport(
    query: PublicIncidentViewportRead,
  ): Promise<IncidentDocument[]> {
    const polygon = [[
      [query.west, query.south],
      [query.east, query.south],
      [query.east, query.north],
      [query.west, query.north],
      [query.west, query.south],
    ]];

    return IncidentModel.find({
      ...publicIncidentFilter(query),
      publicLocation: {
        $geoWithin: {
          $geometry: { type: 'Polygon', coordinates: polygon },
        },
      },
    })
      .select(PUBLIC_READ_PROJECTION)
      .sort({ occurredAt: -1, _id: -1 })
      .exec();
  }

  public async findPublicWithinRadius(
    query: PublicIncidentRadiusRead,
  ): Promise<IncidentDocument[]> {
    return IncidentModel.find({
      ...publicIncidentFilter(query),
      publicLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [query.longitude, query.latitude],
          },
          $maxDistance: query.radiusMeters,
        },
      },
    })
      .select(PUBLIC_READ_PROJECTION)
      .exec();
  }
}
