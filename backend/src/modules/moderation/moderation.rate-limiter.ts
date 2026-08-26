export interface IncidentFlagRateLimitOptions {
  windowMs: number;
  max: number;
  now?: () => number;
}

interface ActorFlagWindow {
  startedAt: number;
  clientFlagIds: Set<string>;
}

export class IncidentFlagRateLimitError extends Error {
  public constructor() {
    super('Too many new incident flags. Please try again later.');
    this.name = 'IncidentFlagRateLimitError';
  }
}

export class IncidentFlagRateLimiter {
  private readonly actors = new Map<string, ActorFlagWindow>();
  private readonly now: () => number;

  public constructor(private readonly options: IncidentFlagRateLimitOptions) {
    this.now = options.now ?? Date.now;
  }

  public reserve(actorId: string, clientFlagId: string): boolean {
    const now = this.now();
    this.removeExpiredWindows(now);

    let window = this.actors.get(actorId);
    if (!window) {
      window = { startedAt: now, clientFlagIds: new Set<string>() };
      this.actors.set(actorId, window);
    }

    if (window.clientFlagIds.has(clientFlagId)) return false;
    if (window.clientFlagIds.size >= this.options.max) {
      throw new IncidentFlagRateLimitError();
    }

    window.clientFlagIds.add(clientFlagId);
    return true;
  }

  public release(actorId: string, clientFlagId: string): void {
    const window = this.actors.get(actorId);
    if (!window) return;
    window.clientFlagIds.delete(clientFlagId);
    if (window.clientFlagIds.size === 0) this.actors.delete(actorId);
  }

  private removeExpiredWindows(now: number): void {
    for (const [actorId, window] of this.actors) {
      if (now - window.startedAt >= this.options.windowMs) this.actors.delete(actorId);
    }
  }
}
