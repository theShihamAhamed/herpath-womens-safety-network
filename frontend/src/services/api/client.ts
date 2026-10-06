import { environment } from '@/src/config/environment';

import { isAuthRecoveryAvailable, recoverAccessToken } from './auth-recovery';
import { apiEndpoints } from './endpoints';
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

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  accessToken?: string;
  skipAuthRecovery?: boolean;
}

const AUTH_RECOVERY_EXCLUDED_ENDPOINTS = new Set<string>(Object.values(apiEndpoints.auth));

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
  return requestWithRecovery<T>(endpoint, options, false);
}

async function requestWithRecovery<T>(
  endpoint: string,
  options: ApiRequestOptions,
  authRecoveryAttempted: boolean,
): Promise<T> {
  const {
    accessToken,
    body,
    skipAuthRecovery = false,
    ...requestInit
  } = options;
  const headers = new Headers(requestInit.headers);
  headers.set('Accept', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${environment.apiBaseUrl}${endpoint}`, {
      ...requestInit,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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
    const error = new ApiError({
      status: response.status,
      code: payload.error.code,
      message: payload.error.message,
      details: Array.isArray(payload.error.details) ? payload.error.details : [],
      requestId: payload.requestId,
    });

    if (
      response.status === 401
      && Boolean(accessToken)
      && !authRecoveryAttempted
      && !skipAuthRecovery
      && !AUTH_RECOVERY_EXCLUDED_ENDPOINTS.has(endpoint)
      && isAuthRecoveryAvailable()
    ) {
      const recoveredAccessToken = await recoverAccessToken();
      return requestWithRecovery<T>(
        endpoint,
        { ...options, accessToken: recoveredAccessToken },
        true,
      );
    }

    throw error;
  }

  throw new ApiError({
    status: response.status,
    code: 'INVALID_API_RESPONSE',
    message: 'HerPath received an unexpected server response.',
  });
}
