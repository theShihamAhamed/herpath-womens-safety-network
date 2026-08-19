import { describe, expect, it } from 'vitest';

import { IncidentRateLimiter } from '../../src/modules/incidents/incident.rate-limiter.js';

describe('incident actor quota', () => {
  it('counts distinct submission IDs per actor and allows replays', () => {
    const limiter = new IncidentRateLimiter({ windowMs: 900_000, max: 2 });

    limiter.reserve('actor-a', 'submission-1');
    limiter.reserve('actor-a', 'submission-1');
    limiter.reserve('actor-a', 'submission-2');
    expect(() => limiter.reserve('actor-a', 'submission-3')).toThrow(/Too many new reports/);
    expect(() => limiter.reserve('actor-b', 'submission-3')).not.toThrow();
  });

  it('starts a fresh actor window after expiration', () => {
    let now = 1_000;
    const limiter = new IncidentRateLimiter({ windowMs: 100, max: 1, now: () => now });

    limiter.reserve('actor', 'submission-1');
    expect(() => limiter.reserve('actor', 'submission-2')).toThrow();
    now += 100;
    expect(() => limiter.reserve('actor', 'submission-2')).not.toThrow();
  });
});
