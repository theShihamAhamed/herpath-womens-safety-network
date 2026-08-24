import { IncidentModel } from './incident.model.js';
import {
  INCIDENT_COMMUNITY_STATES,
  INCIDENT_MODERATION_STATES,
  INCIDENT_VISIBILITY_STATES,
} from './incident.types.js';

const LIFECYCLE_FIELDS = [
  'visibilityState',
  'communityState',
  'moderationState',
  'lifecycleRevision',
] as const;

type LifecycleField = (typeof LIFECYCLE_FIELDS)[number];

interface LifecycleInspectionDocument {
  status?: unknown;
  supportCount?: unknown;
  visibilityState?: unknown;
  communityState?: unknown;
  moderationState?: unknown;
  lifecycleRevision?: unknown;
}

export interface LifecycleFieldCounts {
  visibilityState: number;
  communityState: number;
  moderationState: number;
  lifecycleRevision: number;
}

export interface IncidentLifecycleMigrationInspection {
  totalIncidents: number;
  missingLifecycleFields: LifecycleFieldCounts;
  partialLifecycleDocuments: number;
  legacyStatusDistribution: Record<string, number>;
  nonZeroSupportCount: number;
  invalidLifecycleValues: number;
  unexpectedLegacyStatuses: number;
  safeRollbackDocuments: number;
  progressedLifecycleDocuments: number;
}

export interface IncidentLifecycleApplyResult {
  before: IncidentLifecycleMigrationInspection;
  modifiedFields: LifecycleFieldCounts;
  after: IncidentLifecycleMigrationInspection;
}

export interface IncidentLifecycleRollbackResult {
  before: IncidentLifecycleMigrationInspection;
  modifiedDocuments: number;
  skippedProgressedDocuments: number;
  after: IncidentLifecycleMigrationInspection;
}

export class IncidentLifecycleMigrationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'IncidentLifecycleMigrationError';
  }
}

function emptyFieldCounts(): LifecycleFieldCounts {
  return {
    visibilityState: 0,
    communityState: 0,
    moderationState: 0,
    lifecycleRevision: 0,
  };
}

function hasOwnField(
  document: LifecycleInspectionDocument,
  field: LifecycleField,
): boolean {
  return Object.prototype.hasOwnProperty.call(document, field);
}

function statusLabel(value: unknown): string {
  return typeof value === 'string' ? value : '<MISSING_OR_INVALID>';
}

function isValidLifecycleValue(
  field: LifecycleField,
  value: unknown,
): boolean {
  switch (field) {
    case 'visibilityState':
      return INCIDENT_VISIBILITY_STATES.some((state) => state === value);
    case 'communityState':
      return INCIDENT_COMMUNITY_STATES.some((state) => state === value);
    case 'moderationState':
      return INCIDENT_MODERATION_STATES.some((state) => state === value);
    case 'lifecycleRevision':
      return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }
}

function isDefaultLifecycleValue(field: LifecycleField, value: unknown): boolean {
  switch (field) {
    case 'visibilityState':
      return value === 'PUBLIC';
    case 'communityState':
      return value === 'UNVERIFIED';
    case 'moderationState':
      return value === 'NOT_QUEUED';
    case 'lifecycleRevision':
      return value === 0;
  }
}

function isSafeRollbackDocument(document: LifecycleInspectionDocument): boolean {
  return (
    document.status === 'PUBLISHED_UNVERIFIED' &&
    LIFECYCLE_FIELDS.every(
      (field) => hasOwnField(document, field) && isDefaultLifecycleValue(field, document[field]),
    )
  );
}

export async function inspectIncidentLifecycleMigration(): Promise<IncidentLifecycleMigrationInspection> {
  const inspection: IncidentLifecycleMigrationInspection = {
    totalIncidents: 0,
    missingLifecycleFields: emptyFieldCounts(),
    partialLifecycleDocuments: 0,
    legacyStatusDistribution: {},
    nonZeroSupportCount: 0,
    invalidLifecycleValues: 0,
    unexpectedLegacyStatuses: 0,
    safeRollbackDocuments: 0,
    progressedLifecycleDocuments: 0,
  };
  const cursor = IncidentModel.collection.find(
    {},
    {
      projection: {
        _id: 0,
        status: 1,
        supportCount: 1,
        visibilityState: 1,
        communityState: 1,
        moderationState: 1,
        lifecycleRevision: 1,
      },
    },
  );

  for await (const rawDocument of cursor) {
    const document = rawDocument as LifecycleInspectionDocument;
    inspection.totalIncidents += 1;

    const label = statusLabel(document.status);
    inspection.legacyStatusDistribution[label] =
      (inspection.legacyStatusDistribution[label] ?? 0) + 1;
    if (typeof document.supportCount === 'number' && document.supportCount !== 0) {
      inspection.nonZeroSupportCount += 1;
    }

    let missingCount = 0;
    let invalidLifecycle = false;
    for (const field of LIFECYCLE_FIELDS) {
      if (!hasOwnField(document, field)) {
        inspection.missingLifecycleFields[field] += 1;
        missingCount += 1;
        continue;
      }
      if (!isValidLifecycleValue(field, document[field])) invalidLifecycle = true;
    }

    if (missingCount > 0 && missingCount < LIFECYCLE_FIELDS.length) {
      inspection.partialLifecycleDocuments += 1;
      if (
        LIFECYCLE_FIELDS.some(
          (field) =>
            hasOwnField(document, field) && !isDefaultLifecycleValue(field, document[field]),
        )
      ) {
        invalidLifecycle = true;
      }
    }
    if (invalidLifecycle) inspection.invalidLifecycleValues += 1;
    if (missingCount > 0 && document.status !== 'PUBLISHED_UNVERIFIED') {
      inspection.unexpectedLegacyStatuses += 1;
    }

    const hasAnyLifecycleField = missingCount < LIFECYCLE_FIELDS.length;
    if (isSafeRollbackDocument(document)) {
      inspection.safeRollbackDocuments += 1;
    } else if (hasAnyLifecycleField) {
      inspection.progressedLifecycleDocuments += 1;
    }
  }

  return inspection;
}

function assertApplyIsSafe(inspection: IncidentLifecycleMigrationInspection): void {
  if (inspection.unexpectedLegacyStatuses > 0) {
    throw new IncidentLifecycleMigrationError(
      'Lifecycle migration stopped because legacy incidents contain unexpected statuses.',
    );
  }
  if (inspection.invalidLifecycleValues > 0) {
    throw new IncidentLifecycleMigrationError(
      'Lifecycle migration stopped because incidents contain invalid lifecycle values.',
    );
  }
}

export async function applyIncidentLifecycleMigration(): Promise<IncidentLifecycleApplyResult> {
  const before = await inspectIncidentLifecycleMigration();
  assertApplyIsSafe(before);

  const visibilityResult = await IncidentModel.collection.updateMany(
    { visibilityState: { $exists: false }, status: 'PUBLISHED_UNVERIFIED' },
    { $set: { visibilityState: 'PUBLIC' } },
  );
  const communityResult = await IncidentModel.collection.updateMany(
    { communityState: { $exists: false }, status: 'PUBLISHED_UNVERIFIED' },
    { $set: { communityState: 'UNVERIFIED' } },
  );
  const moderationResult = await IncidentModel.collection.updateMany(
    { moderationState: { $exists: false }, status: 'PUBLISHED_UNVERIFIED' },
    { $set: { moderationState: 'NOT_QUEUED' } },
  );
  const revisionResult = await IncidentModel.collection.updateMany(
    { lifecycleRevision: { $exists: false }, status: 'PUBLISHED_UNVERIFIED' },
    { $set: { lifecycleRevision: 0 } },
  );
  const after = await inspectIncidentLifecycleMigration();

  if (
    Object.values(after.missingLifecycleFields).some((count) => count > 0) ||
    after.partialLifecycleDocuments > 0 ||
    after.invalidLifecycleValues > 0
  ) {
    throw new IncidentLifecycleMigrationError(
      'Lifecycle migration completed with missing or invalid lifecycle fields.',
    );
  }

  return {
    before,
    modifiedFields: {
      visibilityState: visibilityResult.modifiedCount,
      communityState: communityResult.modifiedCount,
      moderationState: moderationResult.modifiedCount,
      lifecycleRevision: revisionResult.modifiedCount,
    },
    after,
  };
}

export async function rollbackIncidentLifecycleMigration(): Promise<IncidentLifecycleRollbackResult> {
  const before = await inspectIncidentLifecycleMigration();
  const rollbackResult = await IncidentModel.collection.updateMany(
    {
      status: 'PUBLISHED_UNVERIFIED',
      visibilityState: 'PUBLIC',
      communityState: 'UNVERIFIED',
      moderationState: 'NOT_QUEUED',
      lifecycleRevision: 0,
    },
    {
      $unset: {
        visibilityState: '',
        communityState: '',
        moderationState: '',
        lifecycleRevision: '',
      },
    },
  );

  return {
    before,
    modifiedDocuments: rollbackResult.modifiedCount,
    skippedProgressedDocuments: before.progressedLifecycleDocuments,
    after: await inspectIncidentLifecycleMigration(),
  };
}
