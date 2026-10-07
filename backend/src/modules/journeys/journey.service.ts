import { AppError } from '../../common/errors/app-error.js';
import { distanceBetween } from './geo.util.js';
import {
  completeJourney,
  expiryCompletionTime,
  hasRawJourneyCoordinates,
  isJourneyExpired,
} from './journey-lifecycle.js';
import { Journey, type IJourney } from './journey.model.js';
import type { Coordinate, JourneyOutcome, StartJourneyInput } from './journey.types.js';

function activeJourneyRequiredError(): AppError {
  return new AppError({
    statusCode: 409,
    code: 'JOURNEY_NOT_ACTIVE',
    message: 'This journey is not active and cannot be updated.',
  });
}

function journeyNotFoundError(): AppError {
  return new AppError({
    statusCode: 404,
    code: 'JOURNEY_NOT_FOUND',
    message: 'Journey not found.',
  });
}

function activeJourneyExistsError(): AppError {
  return new AppError({
    statusCode: 409,
    code: 'ACTIVE_JOURNEY_EXISTS',
    message: 'You already have an active journey. Finish or cancel it before starting a new one.',
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
}

async function normalizeLifecycle(journey: IJourney, now = new Date()): Promise<IJourney> {
  if (isJourneyExpired(journey, now)) {
    completeJourney(journey, expiryCompletionTime(journey, now));
    await journey.save();
  } else if (
    journey.status === 'COMPLETED'
    && (journey.outcome === null || hasRawJourneyCoordinates(journey))
  ) {
    completeJourney(journey, journey.endTime ?? now);
    await journey.save();
  }

  return journey;
}

async function findOwnedJourney(journeyId: string, userId: string): Promise<IJourney> {
  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) throw journeyNotFoundError();
  return normalizeLifecycle(journey);
}

export async function expireStaleJourneysForUser(userId: string, now = new Date()): Promise<number> {
  const activeJourneys = await Journey.find({ userId, status: 'ACTIVE' });
  let expired = 0;

  for (const journey of activeJourneys) {
    if (!isJourneyExpired(journey, now)) continue;
    completeJourney(journey, expiryCompletionTime(journey, now));
    await journey.save();
    expired += 1;
  }

  return expired;
}

export async function startJourney(userId: string, input: StartJourneyInput) {
  await expireStaleJourneysForUser(userId);

  const existingActive = await Journey.findOne({ userId, status: 'ACTIVE' });
  if (existingActive) throw activeJourneyExistsError();

  const selectedRoute: {
    polyline: string;
    distance?: number;
    duration?: number;
    riskScore?: number;
  } = { polyline: input.polyline };

  if (input.distance !== undefined) selectedRoute.distance = input.distance;
  if (input.duration !== undefined) selectedRoute.duration = input.duration;
  if (input.riskScore !== undefined) selectedRoute.riskScore = input.riskScore;

  try {
    const origin = {
      latitude: input.origin.latitude,
      longitude: input.origin.longitude,
      ...(input.origin.address === undefined ? {} : { address: input.origin.address }),
    };
    const destination = {
      latitude: input.destination.latitude,
      longitude: input.destination.longitude,
      ...(input.destination.address === undefined ? {} : { address: input.destination.address }),
    };
    return await Journey.create({
      userId,
      routeId: input.routeId,
      origin,
      destination,
      selectedRoute,
      startTime: new Date(),
      status: 'ACTIVE',
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw activeJourneyExistsError();
    throw error;
  }
}

export async function updateLocation(journeyId: string, userId: string, point: Coordinate) {
  const journey = await findOwnedJourney(journeyId, userId);
  if (journey.status !== 'ACTIVE') throw activeJourneyRequiredError();

  const last = journey.currentPath[journey.currentPath.length - 1];
  if (last) journey.distanceTravelled += distanceBetween(last, point);

  journey.currentPath.push({ ...point, timestamp: new Date() });
  if (journey.startTime) {
    journey.duration = Math.round((Date.now() - journey.startTime.getTime()) / 1_000);
  }
  await journey.save();
  return journey;
}

export async function addCheckIn(journeyId: string, userId: string, point: Coordinate) {
  const journey = await findOwnedJourney(journeyId, userId);
  if (journey.status !== 'ACTIVE') throw activeJourneyRequiredError();

  journey.checkIns.push({ ...point, timestamp: new Date() });
  journey.checkInCount += 1;
  await journey.save();
  return journey;
}

export async function recordDeviation(journeyId: string, userId: string, location: Coordinate) {
  const journey = await findOwnedJourney(journeyId, userId);
  if (journey.status !== 'ACTIVE') throw activeJourneyRequiredError();

  journey.deviationDetected = true;
  journey.deviationLocation = location;
  journey.deviationTime = new Date();
  await journey.save();
  return journey;
}

export async function finishJourney(journeyId: string, userId: string) {
  const journey = await findOwnedJourney(journeyId, userId);
  if (journey.status === 'COMPLETED' && !hasRawJourneyCoordinates(journey)) return journey;

  completeJourney(journey);
  await journey.save();
  return journey;
}

export async function cancelJourney(journeyId: string, userId: string) {
  const journey = await findOwnedJourney(journeyId, userId);
  if (journey.status !== 'ACTIVE') throw activeJourneyRequiredError();

  completeJourney(journey);
  await journey.save();
  return journey;
}

export async function setOutcome(journeyId: string, userId: string, outcome: JourneyOutcome) {
  const journey = await findOwnedJourney(journeyId, userId);

  if (journey.status !== 'COMPLETED') {
    throw new AppError({
      statusCode: 409,
      code: 'JOURNEY_NOT_COMPLETED',
      message: 'Outcome can only be submitted after the journey is completed.',
    });
  }

  if (journey.outcome === outcome) return journey;

  if (journey.outcome !== 'UNKNOWN') {
    throw new AppError({
      statusCode: 409,
      code: 'OUTCOME_LOCKED',
      message: 'A confirmed journey outcome cannot be changed.',
    });
  }

  journey.outcome = outcome;
  await journey.save();
  return journey;
}

export async function getHistory(userId: string) {
  await expireStaleJourneysForUser(userId);
  return Journey.find({ userId })
    .sort({ createdAt: -1 })
    .select(
      'destination startTime endTime duration distanceTravelled checkInCount '
      + 'deviationDetected outcome status createdAt',
    );
}

export async function getJourneyById(journeyId: string, userId: string) {
  return findOwnedJourney(journeyId, userId);
}

export async function getAnalyticsSummary(userId: string) {
  await expireStaleJourneysForUser(userId);
  const journeys = await Journey.find({ userId }).select('outcome status');

  const active = journeys.filter((journey) => journey.status === 'ACTIVE').length;
  const completed = journeys.filter((journey) => journey.status === 'COMPLETED');
  const safe = completed.filter((journey) => journey.outcome === 'SAFE_CONFIRMED').length;
  const incident = completed.filter((journey) => journey.outcome === 'INCIDENT_REPORTED').length;
  const unknown = completed.filter(
    (journey) => journey.outcome === 'UNKNOWN' || !journey.outcome,
  ).length;

  const resolvedCount = safe + incident;
  const percentage = (count: number, denominator: number) => (
    denominator === 0 ? 0 : Number(((count / denominator) * 100).toFixed(1))
  );

  return {
    activeJourneys: active,
    completedJourneys: completed.length,
    safeJourneys: safe,
    incidentJourneys: incident,
    unknownJourneys: unknown,
    safePercentage: percentage(safe, completed.length),
    incidentPercentage: percentage(incident, completed.length),
    unknownPercentage: percentage(unknown, completed.length),
    observedIncidentRate: percentage(incident, resolvedCount),
  };
}
