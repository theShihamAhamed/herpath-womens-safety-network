import {
  completeJourney,
  expiryCompletionTime,
  hasRawJourneyCoordinates,
  isJourneyExpired,
  journeyStartedAt,
  purgeRawJourneyCoordinates,
} from './journey-lifecycle.js';
import { Journey, type IJourney } from './journey.model.js';

export type JourneyReconciliationReason =
  | 'EXPIRED_ACTIVE'
  | 'DUPLICATE_ACTIVE'
  | 'TERMINAL_RAW_COORDINATES'
  | 'TERMINAL_MISSING_OUTCOME';

export interface JourneyReconciliationAction {
  journeyId: string;
  userId: string;
  startTime: string;
  reasons: JourneyReconciliationReason[];
}

export interface JourneyReconciliationResult {
  mode: 'dry-run' | 'apply';
  scanned: number;
  duplicateActiveUsers: string[];
  retained: Omit<JourneyReconciliationAction, 'reasons'>[];
  retainedActive: number;
  actions: JourneyReconciliationAction[];
  changed: number;
}

export interface JourneyReconciliationOptions {
  apply?: boolean;
  now?: Date;
}

function actionFor(
  journey: IJourney,
  reasons: JourneyReconciliationReason[],
): JourneyReconciliationAction {
  return {
    journeyId: journey._id.toString(),
    userId: journey.userId.toString(),
    startTime: journeyStartedAt(journey).toISOString(),
    reasons,
  };
}

export async function reconcileJourneys(
  options: JourneyReconciliationOptions = {},
): Promise<JourneyReconciliationResult> {
  const apply = options.apply ?? false;
  const now = options.now ?? new Date();
  const journeys = await Journey.find({}).sort({ userId: 1, startTime: -1, createdAt: -1 });
  const activeByUser = new Map<string, IJourney[]>();
  const actions: JourneyReconciliationAction[] = [];
  const duplicateActiveUsers: string[] = [];
  const retained: Omit<JourneyReconciliationAction, 'reasons'>[] = [];

  for (const journey of journeys) {
    if (journey.status === 'ACTIVE') {
      const userId = journey.userId.toString();
      const userJourneys = activeByUser.get(userId) ?? [];
      userJourneys.push(journey);
      activeByUser.set(userId, userJourneys);
      continue;
    }

    const reasons: JourneyReconciliationReason[] = [];
    if (hasRawJourneyCoordinates(journey)) reasons.push('TERMINAL_RAW_COORDINATES');
    if (journey.outcome === null) reasons.push('TERMINAL_MISSING_OUTCOME');
    if (reasons.length > 0) actions.push(actionFor(journey, reasons));
  }

  for (const [userId, userJourneys] of activeByUser) {
    if (userJourneys.length > 1) duplicateActiveUsers.push(userId);
    const ordered = [...userJourneys].sort(
      (left, right) => journeyStartedAt(right).getTime() - journeyStartedAt(left).getTime(),
    );
    let retainedValidJourney = false;

    for (const journey of ordered) {
      if (isJourneyExpired(journey, now)) {
        actions.push(actionFor(journey, ['EXPIRED_ACTIVE']));
      } else if (!retainedValidJourney) {
        retainedValidJourney = true;
        retained.push({
          journeyId: journey._id.toString(),
          userId,
          startTime: journeyStartedAt(journey).toISOString(),
        });
      } else {
        actions.push(actionFor(journey, ['DUPLICATE_ACTIVE']));
      }
    }
  }

  let changed = 0;
  if (apply) {
    for (const action of actions) {
      const journey = await Journey.findById(action.journeyId);
      if (!journey) continue;

      if (journey.status === 'ACTIVE') {
        const completedAt = action.reasons.includes('EXPIRED_ACTIVE')
          ? expiryCompletionTime(journey, now)
          : now;
        completeJourney(journey, completedAt);
      } else {
        journey.outcome ??= 'UNKNOWN';
        purgeRawJourneyCoordinates(journey);
      }

      await journey.save();
      changed += 1;
    }
  }

  return {
    mode: apply ? 'apply' : 'dry-run',
    scanned: journeys.length,
    duplicateActiveUsers,
    retained,
    retainedActive: retained.length,
    actions,
    changed,
  };
}
