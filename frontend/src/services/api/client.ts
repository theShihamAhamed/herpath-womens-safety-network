import { environment } from '@/src/config/environment';

import { ApiError } from './errors';

interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: Record<string, unknown>;
}

interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
  requestId?: string;
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  accessToken?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiSuccess<T>(value: unknown): value is ApiSuccess<T> {
  return isRecord(value) && value.success === true && 'data' in value;
}

function isApiFailure(value: unknown): value is ApiFailure {
  return (
    isRecord(value) &&
    value.success === false &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${environment.apiBaseUrl}${endpoint}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach HerPath. Check the API connection and try again.',
      cause: error,
    });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await response.text()) as unknown;
  } catch (error) {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_API_RESPONSE',
      message: 'HerPath received an unexpected server response.',
      cause: error,
    });
  }

  if (isApiSuccess<T>(payload) && response.ok) return payload.data;

  if (isApiFailure(payload)) {
    throw new ApiError({
      status: response.status,
      code: payload.error.code,
      message: payload.error.message,
      details: Array.isArray(payload.error.details) ? payload.error.details : [],
      requestId: payload.requestId,
    });
  }

  throw new ApiError({
    status: response.status,
    code: 'INVALID_API_RESPONSE',
    message: 'HerPath received an unexpected server response.',
  });
}
