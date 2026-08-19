import { AppError } from '../../common/errors/app-error.js';

export interface IncidentRateLimitOptions {
  windowMs: number;
  max: number;
  now?: () => number;
}

interface ActorWindow {
  startedAt: number;
  submissionIds: Set<string>;
}

export class IncidentRateLimiter {
  private readonly actors = new Map<string, ActorWindow>();
  private readonly now: () => number;

  public constructor(private readonly options: IncidentRateLimitOptions) {
    this.now = options.now ?? Date.now;
  }

  public reserve(actorId: string, clientSubmissionId: string): void {
    const now = this.now();
    this.removeExpiredWindows(now);

    let window = this.actors.get(actorId);
    if (!window) {
      window = { startedAt: now, submissionIds: new Set<string>() };
      this.actors.set(actorId, window);
    }

    if (window.submissionIds.has(clientSubmissionId)) return;

    if (window.submissionIds.size >= this.options.max) {
      throw new AppError({
        statusCode: 429,
        code: 'REPORT_RATE_LIMIT_EXCEEDED',
        message: 'Too many new reports. Please try again later.',
      });
    }

    window.submissionIds.add(clientSubmissionId);
  }

  private removeExpiredWindows(now: number): void {
    for (const [actorId, window] of this.actors) {
      if (now - window.startedAt >= this.options.windowMs) {
        this.actors.delete(actorId);
      }
    }
  }
}
