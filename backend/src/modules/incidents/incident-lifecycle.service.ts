import type {
  IncidentLifecycleAction,
  IncidentLifecycleSnapshot,
  IncidentLifecycleState,
  IncidentLifecycleTransitionResult,
  IncidentModerationState,
  IncidentStatus,
} from './incident.types.js';

export class IncidentLifecycleTransitionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'IncidentLifecycleTransitionError';
  }
}

export function deriveLegacyIncidentStatus(state: IncidentLifecycleState): IncidentStatus {
  if (state.visibilityState === 'ARCHIVED') return 'ARCHIVED';
  if (state.visibilityState === 'HIDDEN') return 'REJECTED';
  if (state.moderationState === 'RESOLVED') return 'MODERATOR_REVIEWED';
  if (state.communityState === 'CONFLICTED') return 'DISPUTED';
  if (state.communityState === 'SUPPORTED') return 'COMMUNITY_SUPPORTED';
  return 'PUBLISHED_UNVERIFIED';
}

function invalidModerationTransition(
  action: IncidentLifecycleAction['type'],
  current: IncidentModerationState,
): never {
  throw new IncidentLifecycleTransitionError(
    `Cannot apply ${action} while moderation state is ${current}`,
  );
}

function moderationStateAfterAction(
  current: IncidentModerationState,
  action: IncidentLifecycleAction,
): IncidentModerationState {
  switch (action.type) {
    case 'SET_VISIBILITY':
    case 'SET_COMMUNITY_STATE':
      return current;
    case 'RESOLVE_REVIEW_WITH_VISIBILITY':
      if (current === 'RESOLVED') return current;
      if (current === 'IN_REVIEW' || current === 'AWAITING_REPORTER') return 'RESOLVED';
      return invalidModerationTransition(action.type, current);
    case 'QUEUE':
      if (current === 'QUEUED') return current;
      if (current === 'NOT_QUEUED') return 'QUEUED';
      return invalidModerationTransition(action.type, current);
    case 'START_REVIEW':
      if (current === 'IN_REVIEW') return current;
      if (current === 'QUEUED') return 'IN_REVIEW';
      return invalidModerationTransition(action.type, current);
    case 'REQUEST_REPORTER_INFORMATION':
      if (current === 'AWAITING_REPORTER') return current;
      if (current === 'IN_REVIEW') return 'AWAITING_REPORTER';
      return invalidModerationTransition(action.type, current);
    case 'RESUME_REVIEW':
      if (current === 'IN_REVIEW') return current;
      if (current === 'AWAITING_REPORTER') return 'IN_REVIEW';
      return invalidModerationTransition(action.type, current);
    case 'RESOLVE_REVIEW':
      if (current === 'RESOLVED') return current;
      if (current === 'IN_REVIEW' || current === 'AWAITING_REPORTER') return 'RESOLVED';
      return invalidModerationTransition(action.type, current);
    case 'RELEASE_REVIEW':
      if (current === 'QUEUED') return current;
      if (current === 'IN_REVIEW') return 'QUEUED';
      return invalidModerationTransition(action.type, current);
    case 'DISMISS_QUEUE':
      if (current === 'NOT_QUEUED') return current;
      if (current === 'QUEUED') return 'NOT_QUEUED';
      return invalidModerationTransition(action.type, current);
    case 'REOPEN_REVIEW':
      if (current === 'QUEUED') return current;
      if (current === 'RESOLVED') return 'QUEUED';
      return invalidModerationTransition(action.type, current);
  }
}

export function planIncidentLifecycleTransition(
  current: IncidentLifecycleSnapshot,
  action: IncidentLifecycleAction,
): IncidentLifecycleTransitionResult {
  const previous = { ...current };
  const nextState: IncidentLifecycleState = {
    visibilityState:
      action.type === 'SET_VISIBILITY' || action.type === 'RESOLVE_REVIEW_WITH_VISIBILITY'
        ? action.visibilityState
        : current.visibilityState,
    communityState:
      action.type === 'SET_COMMUNITY_STATE' ? action.communityState : current.communityState,
    moderationState: moderationStateAfterAction(current.moderationState, action),
  };
  const changed =
    nextState.visibilityState !== current.visibilityState ||
    nextState.communityState !== current.communityState ||
    nextState.moderationState !== current.moderationState;
  const next: IncidentLifecycleSnapshot = {
    ...nextState,
    lifecycleRevision: changed ? current.lifecycleRevision + 1 : current.lifecycleRevision,
  };

  return {
    changed,
    previous,
    next,
    legacyStatus: deriveLegacyIncidentStatus(next),
  };
}
