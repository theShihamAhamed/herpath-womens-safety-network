import type { IJourney } from './journey.model.js';

export const MAX_ACTIVE_JOURNEY_AGE_MS = 24 * 60 * 60 * 1_000;

export function journeyStartedAt(journey: Pick<IJourney, 'startTime' | 'createdAt'>): Date {
  return journey.startTime ?? journey.createdAt;
}

export function isJourneyExpired(
  journey: Pick<IJourney, 'startTime' | 'createdAt' | 'status'>,
  now = new Date(),
): boolean {
  return journey.status === 'ACTIVE'
    && now.getTime() - journeyStartedAt(journey).getTime() >= MAX_ACTIVE_JOURNEY_AGE_MS;
}

export function hasRawJourneyCoordinates(
  journey: Pick<IJourney, 'currentPath' | 'checkIns' | 'deviationLocation'>,
): boolean {
  return journey.currentPath.length > 0
    || journey.checkIns.length > 0
    || journey.deviationLocation !== null;
}

export function purgeRawJourneyCoordinates(journey: IJourney): void {
  journey.checkInCount = Math.max(journey.checkInCount, journey.checkIns.length);
  journey.currentPath.splice(0, journey.currentPath.length);
  journey.checkIns.splice(0, journey.checkIns.length);
  journey.deviationLocation = null;
}

export function completeJourney(
  journey: IJourney,
  completedAt = new Date(),
): void {
  if (journey.status === 'ACTIVE') {
    journey.status = 'COMPLETED';
    journey.endTime = completedAt;
    if (journey.startTime) {
      journey.duration = Math.max(
        journey.duration,
        Math.round((completedAt.getTime() - journey.startTime.getTime()) / 1_000),
      );
    }
  }

  journey.outcome ??= 'UNKNOWN';
  purgeRawJourneyCoordinates(journey);
}

export function expiryCompletionTime(
  journey: Pick<IJourney, 'startTime' | 'createdAt'>,
  now = new Date(),
): Date {
  const expiry = journeyStartedAt(journey).getTime() + MAX_ACTIVE_JOURNEY_AGE_MS;
  return new Date(Math.min(now.getTime(), expiry));
}
