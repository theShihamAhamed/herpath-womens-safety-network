import { describe, expect, it } from 'vitest';

import {
  deriveLegacyIncidentStatus,
  IncidentLifecycleTransitionError,
  planIncidentLifecycleTransition,
} from '../../src/modules/incidents/incident-lifecycle.service.js';
import type {
  IncidentLifecycleAction,
  IncidentLifecycleSnapshot,
  IncidentLifecycleState,
  IncidentModerationState,
} from '../../src/modules/incidents/incident.types.js';

const initialLifecycle: IncidentLifecycleSnapshot = {
  visibilityState: 'PUBLIC',
  communityState: 'UNVERIFIED',
  moderationState: 'NOT_QUEUED',
  lifecycleRevision: 0,
};

function lifecycleState(overrides: Partial<IncidentLifecycleState> = {}): IncidentLifecycleState {
  return {
    visibilityState: 'PUBLIC',
    communityState: 'UNVERIFIED',
    moderationState: 'NOT_QUEUED',
    ...overrides,
  };
}

describe('incident lifecycle status compatibility', () => {
  it('derives legacy statuses using visibility, moderation, and community precedence', () => {
    expect(deriveLegacyIncidentStatus(lifecycleState())).toBe('PUBLISHED_UNVERIFIED');
    expect(
      deriveLegacyIncidentStatus(lifecycleState({ communityState: 'SUPPORTED' })),
    ).toBe('COMMUNITY_SUPPORTED');
    expect(
      deriveLegacyIncidentStatus(lifecycleState({ communityState: 'CONFLICTED' })),
    ).toBe('DISPUTED');
    expect(
      deriveLegacyIncidentStatus(
        lifecycleState({ communityState: 'CONFLICTED', moderationState: 'RESOLVED' }),
      ),
    ).toBe('MODERATOR_REVIEWED');
    expect(
      deriveLegacyIncidentStatus(
        lifecycleState({
          visibilityState: 'HIDDEN',
          communityState: 'SUPPORTED',
          moderationState: 'RESOLVED',
        }),
      ),
    ).toBe('REJECTED');
    expect(
      deriveLegacyIncidentStatus(
        lifecycleState({
          visibilityState: 'ARCHIVED',
          communityState: 'CONFLICTED',
          moderationState: 'RESOLVED',
        }),
      ),
    ).toBe('ARCHIVED');
  });

  it('keeps likely-resolved and stale evidence on the unverified compatibility status', () => {
    expect(
      deriveLegacyIncidentStatus(lifecycleState({ communityState: 'LIKELY_RESOLVED' })),
    ).toBe('PUBLISHED_UNVERIFIED');
    expect(deriveLegacyIncidentStatus(lifecycleState({ communityState: 'STALE' }))).toBe(
      'PUBLISHED_UNVERIFIED',
    );
  });
});

describe('incident lifecycle transitions', () => {
  it('supports the complete moderation workflow and increments each revision', () => {
    const actions: IncidentLifecycleAction[] = [
      { type: 'QUEUE' },
      { type: 'START_REVIEW' },
      { type: 'REQUEST_REPORTER_INFORMATION' },
      { type: 'RESUME_REVIEW' },
      { type: 'RESOLVE_REVIEW' },
      { type: 'REOPEN_REVIEW' },
      { type: 'DISMISS_QUEUE' },
    ];
    const expectedStates: IncidentModerationState[] = [
      'QUEUED',
      'IN_REVIEW',
      'AWAITING_REPORTER',
      'IN_REVIEW',
      'RESOLVED',
      'QUEUED',
      'NOT_QUEUED',
    ];
    let current = initialLifecycle;

    actions.forEach((action, index) => {
      const result = planIncidentLifecycleTransition(current, action);
      expect(result.changed).toBe(true);
      expect(result.next.moderationState).toBe(expectedStates[index]);
      expect(result.next.lifecycleRevision).toBe(index + 1);
      current = result.next;
    });
  });

  it('supports release, visibility, and community state changes', () => {
    const queued = planIncidentLifecycleTransition(initialLifecycle, { type: 'QUEUE' }).next;
    const reviewing = planIncidentLifecycleTransition(queued, { type: 'START_REVIEW' }).next;
    const released = planIncidentLifecycleTransition(reviewing, { type: 'RELEASE_REVIEW' });
    const hidden = planIncidentLifecycleTransition(released.next, {
      type: 'SET_VISIBILITY',
      visibilityState: 'HIDDEN',
    });
    const supported = planIncidentLifecycleTransition(hidden.next, {
      type: 'SET_COMMUNITY_STATE',
      communityState: 'SUPPORTED',
    });

    expect(released.next.moderationState).toBe('QUEUED');
    expect(hidden.next.visibilityState).toBe('HIDDEN');
    expect(hidden.legacyStatus).toBe('REJECTED');
    expect(supported.next.communityState).toBe('SUPPORTED');
    expect(supported.legacyStatus).toBe('REJECTED');
  });

  it('resolves moderation and visibility as one atomic lifecycle revision', () => {
    const reviewing: IncidentLifecycleSnapshot = {
      visibilityState: 'PUBLIC',
      communityState: 'SUPPORTED',
      moderationState: 'IN_REVIEW',
      lifecycleRevision: 7,
    };
    const resolved = planIncidentLifecycleTransition(reviewing, {
      type: 'RESOLVE_REVIEW_WITH_VISIBILITY',
      visibilityState: 'HIDDEN',
    });

    expect(resolved).toMatchObject({
      changed: true,
      next: {
        visibilityState: 'HIDDEN',
        communityState: 'SUPPORTED',
        moderationState: 'RESOLVED',
        lifecycleRevision: 8,
      },
      legacyStatus: 'REJECTED',
    });
    expect(reviewing).toMatchObject({
      visibilityState: 'PUBLIC',
      moderationState: 'IN_REVIEW',
      lifecycleRevision: 7,
    });
  });

  it('rejects invalid moderation workflow jumps', () => {
    for (const action of [
      { type: 'START_REVIEW' },
      { type: 'REQUEST_REPORTER_INFORMATION' },
      { type: 'RESOLVE_REVIEW' },
      { type: 'RESOLVE_REVIEW_WITH_VISIBILITY', visibilityState: 'HIDDEN' },
      { type: 'REOPEN_REVIEW' },
    ] as const) {
      expect(() => planIncidentLifecycleTransition(initialLifecycle, action)).toThrow(
        IncidentLifecycleTransitionError,
      );
    }
  });

  it('treats repeated target states as no-ops without incrementing revision', () => {
    const queued: IncidentLifecycleSnapshot = {
      ...initialLifecycle,
      moderationState: 'QUEUED',
      lifecycleRevision: 4,
    };
    const queueReplay = planIncidentLifecycleTransition(queued, { type: 'QUEUE' });
    const publicReplay = planIncidentLifecycleTransition(initialLifecycle, {
      type: 'SET_VISIBILITY',
      visibilityState: 'PUBLIC',
    });

    expect(queueReplay).toMatchObject({ changed: false, next: { lifecycleRevision: 4 } });
    expect(publicReplay).toMatchObject({ changed: false, next: { lifecycleRevision: 0 } });
  });

  it('does not mutate the input snapshot', () => {
    const current = { ...initialLifecycle };
    const before = { ...current };

    const result = planIncidentLifecycleTransition(current, { type: 'QUEUE' });

    expect(current).toEqual(before);
    expect(result.previous).toEqual(before);
    expect(result.previous).not.toBe(current);
    expect(result.next).not.toBe(current);
  });
});
