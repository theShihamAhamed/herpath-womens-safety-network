import { describe, expect, it } from 'vitest';

import {
  IncidentFlagRateLimitError,
  IncidentFlagRateLimiter,
} from '../../src/modules/moderation/moderation.rate-limiter.js';

describe('incident flag actor quota', () => {
  it('counts distinct new flag IDs while allowing exact reservations', () => {
    const limiter = new IncidentFlagRateLimiter({ windowMs: 900_000, max: 2 });

    expect(limiter.reserve('actor-a', 'flag-1')).toBe(true);
    expect(limiter.reserve('actor-a', 'flag-1')).toBe(false);
    expect(limiter.reserve('actor-a', 'flag-2')).toBe(true);
    expect(() => limiter.reserve('actor-a', 'flag-3')).toThrow(IncidentFlagRateLimitError);
    expect(() => limiter.reserve('actor-b', 'flag-3')).not.toThrow();
  });

  it('releases failed reservations and expires actor windows', () => {
    let now = 1_000;
    const limiter = new IncidentFlagRateLimiter({
      windowMs: 100,
      max: 1,
      now: () => now,
    });

    limiter.reserve('actor-a', 'flag-1');
    limiter.release('actor-a', 'flag-1');
    expect(() => limiter.reserve('actor-a', 'flag-2')).not.toThrow();
    expect(() => limiter.reserve('actor-a', 'flag-3')).toThrow();

    now += 100;
    expect(() => limiter.reserve('actor-a', 'flag-3')).not.toThrow();
  });
});
