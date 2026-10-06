import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MAX_ACTIVE_JOURNEY_AGE_MS } from '../../src/modules/journeys/journey-lifecycle.js';
import { ensureJourneyIndexes } from '../../src/modules/journeys/journey-index.service.js';
import { Journey } from '../../src/modules/journeys/journey.model.js';
import { reconcileJourneys } from '../../src/modules/journeys/journey-reconciliation.service.js';

const UNIQUE_ACTIVE_INDEX = 'unique_active_journey_per_user';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri());
  await Journey.syncIndexes();
}, 120_000);

beforeEach(async () => {
  await Journey.deleteMany({});
  try {
    await Journey.collection.dropIndex(UNIQUE_ACTIVE_INDEX);
  } catch (error) {
    if (
      typeof error !== 'object'
      || error === null
      || !('codeName' in error)
      || (error as { codeName?: unknown }).codeName !== 'IndexNotFound'
    ) {
      throw error;
    }
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('journey reconciliation', () => {
  it('defaults to a coordinate-safe dry run with no writes', async () => {
    const { newest, duplicate, stale } = await seedInconsistentJourneys();

    const result = await reconcileJourneys({ now: fixedNow() });

    expect(result.mode).toBe('dry-run');
    expect(result.changed).toBe(0);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.duplicateActiveUsers).toEqual([newest.userId.toString()]);
    expect(result.retained).toEqual([
      expect.objectContaining({ journeyId: newest._id.toString() }),
    ]);
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        journeyId: duplicate._id.toString(),
        reasons: ['DUPLICATE_ACTIVE'],
      }),
      expect.objectContaining({
        journeyId: stale._id.toString(),
        reasons: ['EXPIRED_ACTIVE'],
      }),
    ]));
    expect(JSON.stringify(result)).not.toContain('latitude');
    expect(JSON.stringify(result)).not.toContain('longitude');
    expect((await Journey.findById(stale._id))?.status).toBe('ACTIVE');
  });

  it('repairs stale, duplicate, and legacy terminal records before creating the index', async () => {
    const { newest, duplicate, stale, completed } = await seedInconsistentJourneys();

    await expect(ensureJourneyIndexes()).rejects.toThrow(/duplicate ACTIVE rows/i);
    const result = await reconcileJourneys({ apply: true, now: fixedNow() });
    await ensureJourneyIndexes();

    expect(result.mode).toBe('apply');
    expect(result.changed).toBe(3);
    expect(result.retainedActive).toBe(1);
    expect((await Journey.findById(newest._id))?.status).toBe('ACTIVE');

    for (const id of [duplicate._id, stale._id, completed._id]) {
      const journey = await Journey.findById(id);
      expect(journey?.status).toBe('COMPLETED');
      expect(journey?.outcome).toBe('UNKNOWN');
      expect(journey?.currentPath).toHaveLength(0);
      expect(journey?.checkIns).toHaveLength(0);
      expect(journey?.deviationLocation).toBeNull();
    }
    expect((await Journey.findById(completed._id))?.checkInCount).toBe(1);
    expect(await Journey.countDocuments({ userId: newest.userId, status: 'ACTIVE' })).toBe(1);

    const indexes = await Journey.collection.indexes();
    expect(indexes.some((index) => index.name === UNIQUE_ACTIVE_INDEX && index.unique)).toBe(true);

    const secondRun = await reconcileJourneys({ apply: true, now: fixedNow() });
    expect(secondRun.changed).toBe(0);
    expect(secondRun.actions).toEqual([]);
  });
});

function fixedNow(): Date {
  return new Date('2026-10-06T12:00:00.000Z');
}

async function seedInconsistentJourneys() {
  const userId = new Types.ObjectId();
  const now = fixedNow().getTime();
  const newest = await createJourney(userId, new Date(now - 60_000), 'ACTIVE');
  const duplicate = await createJourney(userId, new Date(now - 120_000), 'ACTIVE');
  const stale = await createJourney(
    userId,
    new Date(now - MAX_ACTIVE_JOURNEY_AGE_MS - 60_000),
    'ACTIVE',
  );
  const completed = await createJourney(new Types.ObjectId(), new Date(now - 180_000), 'COMPLETED');
  return { newest, duplicate, stale, completed };
}

async function createJourney(
  userId: Types.ObjectId,
  startTime: Date,
  status: 'ACTIVE' | 'COMPLETED',
) {
  return Journey.create({
    userId,
    routeId: `route-${new Types.ObjectId().toString()}`,
    origin: { latitude: 6.9, longitude: 79.8 },
    destination: { latitude: 7, longitude: 79.9 },
    selectedRoute: { polyline: 'encoded-route' },
    startTime,
    endTime: status === 'COMPLETED' ? new Date(startTime.getTime() + 60_000) : undefined,
    status,
    outcome: null,
    currentPath: [{ latitude: 6.95, longitude: 79.85, timestamp: startTime }],
    checkIns: [{ latitude: 6.96, longitude: 79.86, timestamp: startTime }],
    deviationDetected: true,
    deviationLocation: { latitude: 6.97, longitude: 79.87 },
    deviationTime: startTime,
  });
}
