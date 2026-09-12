export interface ApiErrorOptions {
  status: number;
  code: string;
  message: string;
  details?: unknown[];
  requestId?: string;
  cause?: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown[];
  public readonly requestId?: string;

  public constructor(options: ApiErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details ?? [];
    this.requestId = options.requestId;
  }
}

export function messageFromError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
