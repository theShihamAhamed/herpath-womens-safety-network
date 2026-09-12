export interface ApiSuccess<T, M extends Record<string, unknown> = Record<string, unknown>> {
  success: true;
  data: T;
  meta: M;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: unknown[];
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  requestId: string;
}
