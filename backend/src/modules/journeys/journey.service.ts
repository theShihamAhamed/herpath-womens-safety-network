import { Journey } from './journey.model.js';
import { distanceBetween } from './geo.util.js';
import { StartJourneyInput, Coordinate, JourneyOutcome } from './journey.types.js';

export async function startJourney(userId: string, input: StartJourneyInput) {
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
  return Journey.findOneAndUpdate(
    { _id: journeyId, userId },
    { $push: { checkIns: { ...point, timestamp: new Date() } } },
    { new: true }
  );
}

export async function recordDeviation(journeyId: string, userId: string, location: Coordinate) {
  return Journey.findOneAndUpdate(
    { _id: journeyId, userId },
    { deviationDetected: true, deviationLocation: location, deviationTime: new Date() },
    { new: true }
  );
}

// Arrival detection just stops tracking - it does NOT set an outcome.
// Outcome always requires an explicit user action (see setOutcome).
export async function finishJourney(journeyId: string, userId: string) {
  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) return null;

  journey.endTime = new Date();
  journey.status = 'COMPLETED';
  if (journey.startTime) {
    journey.duration = Math.round((journey.endTime.getTime() - journey.startTime.getTime()) / 1000);
  }
  await journey.save();
  return journey;
}

export async function setOutcome(journeyId: string, userId: string, outcome: JourneyOutcome) {
  const allowed: JourneyOutcome[] = ['SAFE_CONFIRMED', 'INCIDENT_REPORTED', 'UNKNOWN'];
  if (!allowed.includes(outcome)) {
    const err: any = new Error(`Invalid outcome. Must be one of ${allowed.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const journey = await Journey.findOne({ _id: journeyId, userId });
  if (!journey) return null;

  // Domain rule: an incident already reported on this journey is never
  // downgraded to safe, even if the user later reaches the destination.
  if (journey.outcome === 'INCIDENT_REPORTED' && outcome !== 'INCIDENT_REPORTED') {
    const err: any = new Error('This journey already has a reported incident and cannot be marked safe.');
    err.statusCode = 409;
    throw err;
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
  const journeys = await Journey.find({ userId }).select('outcome');
  const total = journeys.length;
  const safe = journeys.filter((j) => j.outcome === 'SAFE_CONFIRMED').length;
  const incident = journeys.filter((j) => j.outcome === 'INCIDENT_REPORTED').length;
  const unknown = total - safe - incident; // covers UNKNOWN and unresolved/null

  const pct = (n: number) => (total === 0 ? 0 : Number(((n / total) * 100).toFixed(1)));

  return {
    totalJourneys: total,
    safeJourneys: safe,
    incidentJourneys: incident,
    unknownJourneys: unknown,
    safePercentage: pct(safe),
    incidentPercentage: pct(incident),
    unknownPercentage: pct(unknown),
  };
}