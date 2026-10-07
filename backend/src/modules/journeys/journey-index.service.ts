import { Journey } from './journey.model.js';

export class JourneyIndexPreconditionError extends Error {
  public constructor() {
    super(
      'Cannot create the active-journey index while duplicate ACTIVE rows exist. '
      + 'Run the journey reconciliation dry-run, review it, then explicitly apply it.',
    );
    this.name = 'JourneyIndexPreconditionError';
  }
}

export async function ensureJourneyIndexes(): Promise<void> {
  const duplicateActiveUser = await Journey.aggregate<{ _id: unknown }>([
    { $match: { status: 'ACTIVE' } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ]);

  if (duplicateActiveUser.length > 0) throw new JourneyIndexPreconditionError();
  await Journey.createIndexes();
}
