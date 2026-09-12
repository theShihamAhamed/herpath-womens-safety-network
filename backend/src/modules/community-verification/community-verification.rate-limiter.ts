export interface CommunityVerificationRateLimitOptions {
  windowMs: number;
  max: number;
  now?: () => number;
}

interface ActorMutationWindow {
  startedAt: number;
  mutationIds: Set<string>;
}

export class CommunityVerificationRateLimitError extends Error {
  public constructor() {
    super('Too many community feedback changes. Please try again later.');
    this.name = 'CommunityVerificationRateLimitError';
  }
}

export class CommunityVerificationRateLimiter {
  private readonly actors = new Map<string, ActorMutationWindow>();
  private readonly now: () => number;

  public constructor(private readonly options: CommunityVerificationRateLimitOptions) {
    this.now = options.now ?? Date.now;
  }

  public reserve(actorId: string, mutationId: string): void {
    const now = this.now();
    this.removeExpiredWindows(now);

    let window = this.actors.get(actorId);
    if (!window) {
      window = { startedAt: now, mutationIds: new Set<string>() };
      this.actors.set(actorId, window);
    }

    if (window.mutationIds.has(mutationId)) return;
    if (window.mutationIds.size >= this.options.max) {
      throw new CommunityVerificationRateLimitError();
    }

    window.mutationIds.add(mutationId);
  }

  private removeExpiredWindows(now: number): void {
    for (const [actorId, window] of this.actors) {
      if (now - window.startedAt >= this.options.windowMs) this.actors.delete(actorId);
    }
  }
}
