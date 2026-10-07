/// <reference types="jest" />

import { registerAuthRecovery } from './auth-recovery';
import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import { ApiError } from './errors';

jest.mock('@/src/config/environment', () => ({
  environment: { apiBaseUrl: 'http://api.test/api/v1' },
}));

const originalFetch = globalThis.fetch;
let unregister: (() => void) | undefined;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  unregister?.();
  unregister = undefined;
  globalThis.fetch = originalFetch;
});

describe('apiRequest runtime authentication recovery', () => {
  it('refreshes one 401 and replays the exact mutation once with the new token', async () => {
    const recover = jest.fn(async () => 'new-access-token');
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(apiFailure(401, 'AUTHENTICATION_REQUIRED'))
      .mockResolvedValueOnce(apiSuccess({ saved: true }));
    globalThis.fetch = fetchMock;
    const body = { clientSubmissionId: 'same-client-uuid', response: 'SUPPORT' };

    await expect(apiRequest('/incidents/incident-1/feedback?source=card', {
      method: 'POST',
      accessToken: 'expired-access-token',
      headers: { 'X-Intent': 'same-intent' },
      body,
    })).resolves.toEqual({ saved: true });

    expect(recover).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(fetchMock.mock.calls[1]?.[0]);
    expect(requestHeader(fetchMock, 0, 'Authorization')).toBe('Bearer expired-access-token');
    expect(requestHeader(fetchMock, 1, 'Authorization')).toBe('Bearer new-access-token');
    expect(requestHeader(fetchMock, 1, 'X-Intent')).toBe('same-intent');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(body));
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify(body));
  });

  it('shares one refresh across simultaneous mutations without changing intent IDs', async () => {
    const refresh = deferred<string>();
    const recover = jest.fn(() => refresh.promise);
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get('Authorization');
      return authorization === 'Bearer current-token'
        ? apiSuccess({ resumed: true })
        : apiFailure(401, 'AUTHENTICATION_REQUIRED');
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const bodies = ['feedback-uuid', 'flag-uuid', 'journey-uuid'].map((clientSubmissionId) => ({
      clientSubmissionId,
      value: 'unchanged',
    }));

    const requests = bodies.map((body, index) => apiRequest(`/protected/${index}`, {
      method: 'POST',
      accessToken: 'expired-token',
      body,
    }));
    await waitForCondition(() => recover.mock.calls.length === 1);
    refresh.resolve('current-token');

    await expect(Promise.all(requests)).resolves.toEqual([
      { resumed: true },
      { resumed: true },
      { resumed: true },
    ]);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    for (const body of bodies) {
      expect(fetchMock.mock.calls.filter((call) => call[1]?.body === JSON.stringify(body))).toHaveLength(2);
    }
  });

  it('stops after the retried request receives a second 401', async () => {
    const recover = jest.fn(async () => 'new-token');
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    const fetchMock = jest.fn(async () => apiFailure(401, 'AUTHENTICATION_REQUIRED'));
    globalThis.fetch = fetchMock;

    await expect(apiRequest('/protected', { accessToken: 'expired-token' }))
      .rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(recover).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(Object.entries(apiEndpoints.auth))(
    'never recurses for the %s auth endpoint',
    async (_name, endpoint) => {
    const recover = jest.fn(async () => 'new-token');
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    const fetchMock = jest.fn(async () => apiFailure(401, 'INVALID_REFRESH_TOKEN'));
    globalThis.fetch = fetchMock;

    await expect(apiRequest(endpoint, {
      method: 'POST',
      accessToken: 'unexpected-token',
      body: { refreshToken: 'refresh-token' },
    })).rejects.toMatchObject({ status: 401, code: 'INVALID_REFRESH_TOKEN' });
    expect(recover).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([400, 403, 404, 409, 500])(
    'does not refresh an original HTTP %s response',
    async (status) => {
      const recover = jest.fn(async () => 'new-token');
      unregister = registerAuthRecovery({ recoverAccessToken: recover });
      const fetchMock = jest.fn(async () => apiFailure(status, 'REQUEST_FAILED'));
      globalThis.fetch = fetchMock;

      await expect(apiRequest('/protected', { accessToken: 'access-token' }))
        .rejects.toMatchObject({ status, code: 'REQUEST_FAILED' });
      expect(recover).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('does not refresh a network failure or timeout', async () => {
    const recover = jest.fn(async () => 'new-token');
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });

    await expect(apiRequest('/protected', { accessToken: 'access-token' }))
      .rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(recover).not.toHaveBeenCalled();
  });

  it('does not refresh an invalid 401 response body', async () => {
    const recover = jest.fn(async () => 'new-token');
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'not-json',
    } as Response));

    await expect(apiRequest('/protected', { accessToken: 'access-token' }))
      .rejects.toMatchObject({ status: 401, code: 'INVALID_API_RESPONSE' });
    expect(recover).not.toHaveBeenCalled();
  });

  it('does not refresh an original 429 response', async () => {
    const recover = jest.fn(async () => 'new-token');
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    const fetchMock = jest.fn(async () => apiFailure(429, 'RATE_LIMIT_EXCEEDED'));
    globalThis.fetch = fetchMock;

    await expect(apiRequest('/protected', { accessToken: 'access-token' }))
      .rejects.toMatchObject({ status: 429, code: 'RATE_LIMIT_EXCEEDED' });
    expect(recover).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not replay when the shared refresh fails with 429', async () => {
    const recover = jest.fn(async () => {
      throw new ApiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Try later' });
    });
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    const fetchMock = jest.fn(async () => apiFailure(401, 'AUTHENTICATION_REQUIRED'));
    globalThis.fetch = fetchMock;

    await expect(apiRequest('/protected', { accessToken: 'expired-token' }))
      .rejects.toMatchObject({ status: 429, code: 'RATE_LIMIT_EXCEEDED' });
    expect(recover).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honors an explicit recovery opt-out', async () => {
    const recover = jest.fn(async () => 'new-token');
    unregister = registerAuthRecovery({ recoverAccessToken: recover });
    globalThis.fetch = jest.fn(async () => apiFailure(401, 'AUTHENTICATION_REQUIRED'));

    await expect(apiRequest('/protected', {
      accessToken: 'expired-token',
      skipAuthRecovery: true,
    })).rejects.toMatchObject({ status: 401 });
    expect(recover).not.toHaveBeenCalled();
  });
});

function apiSuccess(data: unknown): Response {
  return response(200, { success: true, data, meta: {} });
}

function apiFailure(status: number, code: string): Response {
  return response(status, {
    success: false,
    error: { code, message: code, details: [] },
    requestId: 'request-id',
  });
}

function response(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function requestHeader(fetchMock: jest.Mock, callIndex: number, name: string): string | null {
  return new Headers(fetchMock.mock.calls[callIndex]?.[1]?.headers).get(name);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForCondition(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Condition was not reached');
}
