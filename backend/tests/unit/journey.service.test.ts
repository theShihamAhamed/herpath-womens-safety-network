import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import * as journeyService from '../../src/modules/journeys/journey.service.js';
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
    ).rejects.toThrow(/cannot be marked safe/i);
  });

  it('cancel marks the journey UNKNOWN', async () => {
    const journey = await journeyService.startJourney(userId, mockInput());
    const cancelled = await journeyService.cancelJourney(journey._id.toString(), userId);
    expect(cancelled?.status).toBe('COMPLETED');
    expect(cancelled?.outcome).toBe('UNKNOWN');
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