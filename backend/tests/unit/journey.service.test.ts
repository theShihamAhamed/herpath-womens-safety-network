import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import * as journeyService from '../../src/modules/journeys/journey.service.js';
import { MAX_ACTIVE_JOURNEY_AGE_MS } from '../../src/modules/journeys/journey-lifecycle.js';
import { Journey } from '../../src/modules/journeys/journey.model.js';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
  });
  await mongoose.connect(mongo.getUri());
}, 600_000);

beforeEach(async () => {
  await Journey.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('journey lifecycle rules', () => {
  const userId = new Types.ObjectId().toString();

  it('prevents starting a second active journey', async () => {
    await journeyService.startJourney(userId, mockInput());
    await expect(journeyService.startJourney(userId, mockInput())).rejects.toThrow(/already have an active journey/i);
  });

  it('rejects location updates on a non-active journey', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    await journeyService.finishJourney(journey._id.toString(), userId);
    await expect(
      journeyService.updateLocation(journey._id.toString(), userId, { latitude: 1, longitude: 1 })
    ).rejects.toThrow(/not active/i);
  });

  it('finish is idempotent', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    const first = await journeyService.finishJourney(journey._id.toString(), userId);
    const second = await journeyService.finishJourney(journey._id.toString(), userId);
    expect(second?.status).toBe('COMPLETED');
    expect(second?.endTime?.getTime()).toBe(first?.endTime?.getTime());
    expect(second?.outcome).toBe('UNKNOWN');
  });

  it('rejects outcome submission before completion', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    await expect(
      journeyService.setOutcome(journey._id.toString(), userId, 'SAFE_CONFIRMED')
    ).rejects.toThrow(/only be submitted after the journey is completed/i);
  });

  it('never downgrades an incident outcome to safe', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    await journeyService.finishJourney(journey._id.toString(), userId);
    await journeyService.setOutcome(journey._id.toString(), userId, 'INCIDENT_REPORTED');
    await expect(
      journeyService.setOutcome(journey._id.toString(), userId, 'SAFE_CONFIRMED')
    ).rejects.toThrow(/cannot be changed/i);
  });

  it('cancel marks the journey UNKNOWN', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    const cancelled = await journeyService.cancelJourney(journey._id.toString(), userId);
    expect(cancelled?.status).toBe('COMPLETED');
    expect(cancelled?.outcome).toBe('UNKNOWN');
  });

  it('purges raw coordinates while retaining terminal aggregates', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    const id = journey._id.toString();
    await journeyService.updateLocation(id, userId, { latitude: 1.1, longitude: 1.1 });
    await journeyService.addCheckIn(id, userId, { latitude: 1.2, longitude: 1.2 });
    await journeyService.recordDeviation(id, userId, { latitude: 1.3, longitude: 1.3 });

    const completed = await journeyService.finishJourney(id, userId);

    expect(completed.currentPath).toHaveLength(0);
    expect(completed.checkIns).toHaveLength(0);
    expect(completed.checkInCount).toBe(1);
    expect(completed.deviationLocation).toBeNull();
    expect(completed.deviationDetected).toBe(true);
    expect(completed.deviationTime).toBeInstanceOf(Date);
    expect(completed.origin.latitude).toBe(1);
    expect(completed.destination.latitude).toBe(2);
    expect(completed.selectedRoute.polyline).toBe('abc');
  });

  it('expires stale active journeys before accepting an update', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    const staleStart = new Date(Date.now() - MAX_ACTIVE_JOURNEY_AGE_MS - 60_000);
    await Journey.updateOne({ _id: journey._id }, { $set: { startTime: staleStart } });

    await expect(
      journeyService.updateLocation(journey._id.toString(), userId, { latitude: 1, longitude: 1 }),
    ).rejects.toThrow(/not active/i);

    const expired = await Journey.findById(journey._id);
    expect(expired?.status).toBe('COMPLETED');
    expect(expired?.outcome).toBe('UNKNOWN');
    expect(expired?.endTime?.getTime()).toBe(staleStart.getTime() + MAX_ACTIVE_JOURNEY_AGE_MS);
  });

  it('expires a stale journey before starting its replacement', async () => {
    const stale = await journeyService.startJourney(userId, mockInput());
    await Journey.updateOne(
      { _id: stale._id },
      { $set: { startTime: new Date(Date.now() - MAX_ACTIVE_JOURNEY_AGE_MS - 1_000) } },
    );

    const replacement = await journeyService.startJourney(userId, {
      ...mockInput(),
      routeId: 'route-2',
    });

    expect(replacement.status).toBe('ACTIVE');
    expect(await Journey.countDocuments({ userId, status: 'ACTIVE' })).toBe(1);
    expect((await Journey.findById(stale._id))?.status).toBe('COMPLETED');
  });

  it('permits UNKNOWN to resolve once and locks a confirmed outcome', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    await journeyService.finishJourney(journey._id.toString(), userId);
    const safe = await journeyService.setOutcome(
      journey._id.toString(),
      userId,
      'SAFE_CONFIRMED',
    );
    expect(safe.outcome).toBe('SAFE_CONFIRMED');
    await expect(
      journeyService.setOutcome(journey._id.toString(), userId, 'INCIDENT_REPORTED'),
    ).rejects.toThrow(/cannot be changed/i);
  });

  it('uses a structured not-found domain error', async () => {
    await expect(
      journeyService.getJourneyById(new Types.ObjectId().toString(), userId),
    ).rejects.toMatchObject({ statusCode: 404, code: 'JOURNEY_NOT_FOUND' });
  });
});

function mockInput() {
  return {
    routeId: 'route-1',
    origin: { latitude: 1, longitude: 1 },
    destination: { latitude: 2, longitude: 2 },
    polyline: 'abc',
  };
}
