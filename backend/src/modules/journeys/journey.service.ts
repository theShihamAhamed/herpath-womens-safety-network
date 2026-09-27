import { AppError } from '../../common/errors/app-error.js';
import { Journey } from './journey.model.js';
import { distanceBetween } from './geo.util.js';
import type { StartJourneyInput, Coordinate, JourneyOutcome } from './journey.types.js';

function activeJourneyRequiredError() {
  return new AppError({
    statusCode: 409,
    code: 'JOURNEY_NOT_ACTIVE',
    message: 'This journey is not active and cannot be updated.',
  });
}

export async function startJourney(userId: string, input: StartJourneyInput) {
  const existingActive = await Journey.findOne({ userId, status: 'ACTIVE' });
  if (existingActive) {
    throw new AppError({
      statusCode: 409,
      code: 'ACTIVE_JOURNEY_EXISTS',
      message: 'You already have an active journey. Finish or cancel it before starting a new one.',
    });
  }

  const selectedRoute: {
    polyline: string;
    distance?: number;
    duration?: number;
    riskScore?: number;
  } = { polyline: input.polyline };

  if (input.distance !== undefined) selectedRoute.distance = input.distance;
  if (input.duration !== undefined) selectedRoute.duration = input.duration;
  if (input.riskScore !== undefined) selectedRoute.riskScore = input.riskScore;

  return Journey.create({
    userId,
    routeId: input.routeId,
    origin: input.origin,
    destination: input.destination,
    selectedRoute,
    startTime: new Date(),
    status: 'ACTIVE',
  });
}

export async function updateLocation(journeyId: string, userId: string, point: Coordinate) {
  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) return null;
  if (journey.status !== 'ACTIVE') throw activeJourneyRequiredError();

  const last = journey.currentPath[journey.currentPath.length - 1];
  if (last) journey.distanceTravelled += distanceBetween(last, point);

  journey.currentPath.push({ ...point, timestamp: new Date() });
  if (journey.startTime) {
    journey.duration = Math.round((Date.now() - journey.startTime.getTime()) / 1000);
  }
  await journey.save();
  return journey;
}

export async function addCheckIn(journeyId: string, userId: string, point: Coordinate) {
  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) return null;
  if (journey.status !== 'ACTIVE') throw activeJourneyRequiredError();

  journey.checkIns.push({ ...point, timestamp: new Date() });
  await journey.save();
  return journey;
}

export async function recordDeviation(journeyId: string, userId: string, location: Coordinate) {
  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) return null;
  if (journey.status !== 'ACTIVE') throw activeJourneyRequiredError();

  journey.deviationDetected = true;
  journey.deviationLocation = location;
  journey.deviationTime = new Date();
  await journey.save();
  return journey;
}

// Idempotent: calling finish twice on an already-completed journey just
// returns the existing completed journey instead of erroring or double-writing.
export async function finishJourney(journeyId: string, userId: string) {
  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) return null;

  if (journey.status === 'COMPLETED') {
    return journey; // already finished — no-op, keeps repeated calls safe
  }

  journey.endTime = new Date();
  journey.status = 'COMPLETED';
  if (journey.startTime) {
    journey.duration = Math.round((journey.endTime.getTime() - journey.startTime.getTime()) / 1000);
  }
  await journey.save();
  return journey;
}

// Cancelling is only valid while ACTIVE. A cancelled journey is marked
// COMPLETED + outcome UNKNOWN immediately (no ambiguity window).
export async function cancelJourney(journeyId: string, userId: string) {
  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) return null;
  if (journey.status !== 'ACTIVE') throw activeJourneyRequiredError();

  journey.endTime = new Date();
  journey.status = 'COMPLETED';
  journey.outcome = 'UNKNOWN';
  if (journey.startTime) {
    journey.duration = Math.round((journey.endTime.getTime() - journey.startTime.getTime()) / 1000);
  }
  await journey.save();
  return journey;
}

export async function setOutcome(journeyId: string, userId: string, outcome: JourneyOutcome) {
  const allowed: JourneyOutcome[] = ['SAFE_CONFIRMED', 'INCIDENT_REPORTED', 'UNKNOWN'];
  if (!allowed.includes(outcome)) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_OUTCOME',
      message: `Invalid outcome. Must be one of ${allowed.join(', ')}`,
    });
  }

  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) return null;

  // Outcome can only be submitted once the journey is completed.
  if (journey.status !== 'COMPLETED') {
    throw new AppError({
      statusCode: 409,
      code: 'JOURNEY_NOT_COMPLETED',
      message: 'Outcome can only be submitted after the journey is completed.',
    });
  }

  // Idempotent: resubmitting the same outcome is a safe no-op.
  if (journey.outcome === outcome) {
    return journey;
  }

  // An incident already reported is never downgraded to safe.
  if (journey.outcome === 'INCIDENT_REPORTED' && outcome !== 'INCIDENT_REPORTED') {
    throw new AppError({
      statusCode: 409,
      code: 'OUTCOME_LOCKED',
      message: 'This journey already has a reported incident and cannot be marked safe.',
    });
  }

  journey.outcome = outcome;
  await journey.save();
  return journey;
}

export async function getHistory(userId: string) {
  return Journey.find({ userId })
    .sort({ createdAt: -1 })
    .select('destination startTime endTime duration distanceTravelled outcome status createdAt');
}

export async function getJourneyById(journeyId: string, userId: string) {
  return Journey.findOne({ _id: journeyId, userId });
}

export async function getAnalyticsSummary(userId: string) {
  const journeys = await Journey.find({ userId }).select('outcome status');

  const active = journeys.filter((j) => j.status === 'ACTIVE').length;
  const completed = journeys.filter((j) => j.status === 'COMPLETED');
  const safe = completed.filter((j) => j.outcome === 'SAFE_CONFIRMED').length;
  const incident = completed.filter((j) => j.outcome === 'INCIDENT_REPORTED').length;
  // A completed journey with no outcome recorded also counts as Unknown.
  const unknown = completed.filter((j) => j.outcome === 'UNKNOWN' || !j.outcome).length;

  const resolvedCount = safe + incident; // excludes unknown & active, per 7.7
  const pct = (n: number, denom: number) => (denom === 0 ? 0 : Number(((n / denom) * 100).toFixed(1)));

  return {
    activeJourneys: active,
    completedJourneys: completed.length,
    safeJourneys: safe,
    incidentJourneys: incident,
    unknownJourneys: unknown,
    // Percentages are of COMPLETED journeys only — active journeys never dilute these.
    safePercentage: pct(safe, completed.length),
    incidentPercentage: pct(incident, completed.length),
    unknownPercentage: pct(unknown, completed.length),
    // Observed rate per your domain rules doc: incident / resolved (excludes unknown)
    observedIncidentRate: pct(incident, resolvedCount),
  };
}