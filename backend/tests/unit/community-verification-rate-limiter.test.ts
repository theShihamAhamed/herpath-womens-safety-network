import { describe, expect, it } from 'vitest';

import {
  CommunityVerificationRateLimitError,
  CommunityVerificationRateLimiter,
} from '../../src/modules/community-verification/community-verification.rate-limiter.js';

describe('community feedback actor quota', () => {
  it('counts distinct mutations per actor while allowing exact retries', () => {
    const limiter = new CommunityVerificationRateLimiter({ windowMs: 900_000, max: 2 });

    limiter.reserve('actor-a', 'mutation-1');
    limiter.reserve('actor-a', 'mutation-1');
    limiter.reserve('actor-a', 'mutation-2');
    expect(() => limiter.reserve('actor-a', 'mutation-3')).toThrow(
      CommunityVerificationRateLimitError,
    );
    expect(() => limiter.reserve('actor-b', 'mutation-3')).not.toThrow();
  });

  it('starts a fresh actor window after expiration', () => {
    let now = 1_000;
    const limiter = new CommunityVerificationRateLimiter({
      windowMs: 100,
      max: 1,
      now: () => now,
    });

    limiter.reserve('actor-a', 'mutation-1');
    expect(() => limiter.reserve('actor-a', 'mutation-2')).toThrow();
    now += 100;
    expect(() => limiter.reserve('actor-a', 'mutation-2')).not.toThrow();
  });
});
