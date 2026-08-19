import { Buffer } from 'node:buffer';

import { Types } from 'mongoose';

import { AppError } from '../../common/errors/app-error.js';
import type { IncidentDocument } from './incident.model.js';
import { IncidentRateLimiter, type IncidentRateLimitOptions } from './incident.rate-limiter.js';
import { IncidentRepository } from './incident.repository.js';
import type {
  CreateIncidentPersistenceInput,
  IncidentLocationInput,
  IncidentLocationMode,
  OwnerIncidentCursor,
  PublicLocationCell,
} from './incident.types.js';
import type {
  CreateIncidentInput,
  LocationCellsQuery,
  MineQuery,
} from './incident.validation.js';
import {
  SelectableLocationCellLimitError,
  normalizeIncidentLocation,
  selectableLocationCells,
} from './location-privacy.service.js';

export interface OwnerIncident {
  id: string;
  category: IncidentDocument['category'];
  severity: IncidentDocument['severity'];
  status: IncidentDocument['status'];
  occurredAt: string;
  createdAt: string;
  supportCount: number;
  locationMode: IncidentLocationMode;
  description?: string;
}

export interface CreateIncidentResult {
  incident: OwnerIncident;
  created: boolean;
}

export interface OwnerIncidentPage {
  items: OwnerIncident[];
  nextCursor: string | null;
}

interface IdempotencyIntent {
  category: string;
  severity: string;
  occurredAt: string;
  description: string | null;
  location:
    | { mode: 'EXACT_PRIVATE'; coordinates: [number, number] }
    | { mode: 'APPROXIMATE_ONLY'; publicCellId: string };
}

interface SerializedCursor {
  createdAt: string;
  id: string;
}

function toOwnerIncident(incident: IncidentDocument): OwnerIncident {
  return {
    id: incident._id.toString(),
    category: incident.category,
    severity: incident.severity,
    status: incident.status,
    occurredAt: incident.occurredAt.toISOString(),
    createdAt: incident.createdAt.toISOString(),
    supportCount: incident.supportCount,
    locationMode: incident.locationMode,
    ...(incident.description === undefined ? {} : { description: incident.description }),
  };
}

function persistenceLocation(input: CreateIncidentInput): IncidentLocationInput {
  if (input.location.mode === 'EXACT_PRIVATE') {
    return {
      mode: 'EXACT_PRIVATE',
      privateLocation: input.location.privateLocation,
    };
  }

  return {
    mode: 'APPROXIMATE_ONLY',
    publicCellId: input.location.selectedAreaCellId,
  };
}

function intentFromInput(input: CreateIncidentPersistenceInput): IdempotencyIntent {
  const location = normalizeIncidentLocation(input.location);

  return {
    category: input.category,
    severity: input.severity,
    occurredAt: input.occurredAt.toISOString(),
    description: input.description ?? null,
    location:
      location.locationMode === 'EXACT_PRIVATE'
        ? {
            mode: 'EXACT_PRIVATE',
            coordinates: [
              location.privateLocation!.coordinates[0],
              location.privateLocation!.coordinates[1],
            ],
          }
        : {
            mode: 'APPROXIMATE_ONLY',
            publicCellId: location.publicCellId,
          },
  };
}

function intentFromDocument(incident: IncidentDocument): IdempotencyIntent | null {
  if (incident.locationMode === 'EXACT_PRIVATE') {
    if (!incident.privateLocation) return null;
    return {
      category: incident.category,
      severity: incident.severity,
      occurredAt: incident.occurredAt.toISOString(),
      description: incident.description ?? null,
      location: {
        mode: 'EXACT_PRIVATE',
        coordinates: [
          incident.privateLocation.coordinates[0],
          incident.privateLocation.coordinates[1],
        ],
      },
    };
  }

  return {
    category: incident.category,
    severity: incident.severity,
    occurredAt: incident.occurredAt.toISOString(),
    description: incident.description ?? null,
    location: {
      mode: 'APPROXIMATE_ONLY',
      publicCellId: incident.publicCellId,
    },
  };
}

function intentsMatch(left: IdempotencyIntent, right: IdempotencyIntent | null): boolean {
  return right !== null && JSON.stringify(left) === JSON.stringify(right);
}

function idempotencyConflict(): AppError {
  return new AppError({
    statusCode: 409,
    code: 'IDEMPOTENCY_CONFLICT',
    message: 'This submission identifier was already used for different report content.',
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function encodeCursor(incident: IncidentDocument): string {
  const cursor: SerializedCursor = {
    createdAt: incident.createdAt.toISOString(),
    id: incident._id.toString(),
  };
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): OwnerIncidentCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('createdAt' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !Types.ObjectId.isValid(parsed.id)
    ) {
      throw new Error('Invalid cursor shape');
    }

    const createdAt = new Date(parsed.createdAt);
    if (!Number.isFinite(createdAt.getTime())) throw new Error('Invalid cursor timestamp');

    return { createdAt, id: parsed.id };
  } catch (error) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_CURSOR',
      message: 'The report history cursor is invalid.',
      cause: error,
    });
  }
}

export class IncidentService {
  public constructor(
    private readonly incidents: IncidentRepository,
    private readonly limiter: IncidentRateLimiter,
  ) {}

  public async create(reporterId: string, input: CreateIncidentInput): Promise<CreateIncidentResult> {
    const persistenceInput: CreateIncidentPersistenceInput = {
      reporterId,
      clientSubmissionId: input.clientSubmissionId,
      category: input.category,
      severity: input.severity,
      occurredAt: input.occurredAt,
      location: persistenceLocation(input),
      ...(input.description === undefined ? {} : { description: input.description }),
    };
    const intendedContent = intentFromInput(persistenceInput);
    const existing = await this.incidents.findByIdempotencyKey(
      reporterId,
      input.clientSubmissionId,
    );

    if (existing) return this.resolveExisting(existing, intendedContent);

    this.limiter.reserve(reporterId, input.clientSubmissionId);

    try {
      return {
        incident: toOwnerIncident(await this.incidents.create(persistenceInput)),
        created: true,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      const racedIncident = await this.incidents.findByIdempotencyKey(
        reporterId,
        input.clientSubmissionId,
      );
      if (!racedIncident) throw error;
      return this.resolveExisting(racedIncident, intendedContent);
    }
  }

  public listLocationCells(query: LocationCellsQuery): PublicLocationCell[] {
    try {
      return selectableLocationCells(query);
    } catch (error) {
      if (error instanceof SelectableLocationCellLimitError) {
        throw new AppError({
          statusCode: 422,
          code: 'LOCATION_VIEWPORT_TOO_LARGE',
          message: 'Zoom in to choose an approximate reporting area.',
        });
      }
      throw error;
    }
  }

  public async mine(reporterId: string, query: MineQuery): Promise<OwnerIncidentPage> {
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const documents = await this.incidents.findOwnedPage(reporterId, query.limit + 1, cursor);
    const hasNextPage = documents.length > query.limit;
    const pageDocuments = documents.slice(0, query.limit);
    const lastDocument = pageDocuments.at(-1);

    return {
      items: pageDocuments.map(toOwnerIncident),
      nextCursor: hasNextPage && lastDocument ? encodeCursor(lastDocument) : null,
    };
  }

  private resolveExisting(
    existing: IncidentDocument,
    intendedContent: IdempotencyIntent,
  ): CreateIncidentResult {
    if (!intentsMatch(intendedContent, intentFromDocument(existing))) {
      throw idempotencyConflict();
    }

    return { incident: toOwnerIncident(existing), created: false };
  }
}

export function createIncidentService(options: IncidentRateLimitOptions): IncidentService {
  return new IncidentService(new IncidentRepository(), new IncidentRateLimiter(options));
}
