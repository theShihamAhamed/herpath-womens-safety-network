/// <reference types="jest" />

import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';

import { apiRequest } from '@/src/services/api/client';
import { ApiError } from '@/src/services/api/errors';

import { AuthProvider, useAuth } from './auth-provider';
import type { AuthActor, AuthTokenBundle, SignInInput, SignUpInput } from './auth.types';

jest.mock('@/src/config/environment', () => ({
  environment: { apiBaseUrl: 'http://api.test/api/v1' },
}));

const originalFetch = globalThis.fetch;
let latestAuth: ReturnType<typeof useAuth> | null = null;

afterEach(() => {
  cleanup();
  latestAuth = null;
  globalThis.fetch = originalFetch;
});

describe('AuthProvider runtime recovery integration', () => {
  it('keeps startup restoration single-flight and persists rotations before verification', async () => {
    const events: string[] = [];
    const harness = createHarness('startup-refresh', events);
    harness.api.refresh.mockImplementation(async () => {
      events.push('refresh');
      return registeredBundle('startup-access', 'startup-rotated-refresh');
    });
    harness.api.me.mockImplementation(async (accessToken) => {
      events.push(`me:${accessToken}`);
      return registeredActor;
    });
    renderProvider(harness);

    await waitFor(() => expect(auth().accessToken).toBe('startup-access'));
    expect(harness.api.refresh).toHaveBeenCalledTimes(1);
    expect(events.indexOf('set:startup-rotated-refresh')).toBeLessThan(
      events.indexOf('me:startup-access'),
    );

    events.length = 0;
    harness.api.refresh.mockClear();
    harness.api.me.mockClear();
    harness.api.refresh.mockImplementation(async () => {
      events.push('refresh');
      return registeredBundle('retry-access', 'retry-rotated-refresh');
    });
    await act(async () => {
      await Promise.all([auth().retry(), auth().retry(), auth().retry()]);
    });

    expect(harness.api.refresh).toHaveBeenCalledTimes(1);
    expect(harness.api.me).toHaveBeenCalledTimes(1);
    expect(events.indexOf('set:retry-rotated-refresh')).toBeLessThan(
      events.indexOf('me:retry-access'),
    );
  });

  it('preserves startup fallback from an invalid refresh token to an anonymous session', async () => {
    const harness = createHarness('invalid-startup-refresh');
    harness.api.refresh.mockRejectedValueOnce(new ApiError({
      status: 401,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Invalid refresh token',
    }));
    renderProvider(harness);

    await waitFor(() => expect(auth().actor?.accountType).toBe('ANONYMOUS'));
    expect(harness.storage.clear).toHaveBeenCalledTimes(1);
    expect(harness.api.createAnonymous).toHaveBeenCalledTimes(1);
    expect(harness.storedToken()).toBe('anonymous-refresh');
  });

  it('persists the rotated token, publishes the new session, then replays with the new access token', async () => {
    const events: string[] = [];
    const harness = createHarness('initial-refresh', events);
    harness.api.refresh
      .mockResolvedValueOnce(registeredBundle('old-access', 'current-refresh'))
      .mockImplementationOnce(async () => {
        events.push('runtime-refresh');
        return registeredBundle('new-access', 'new-rotated-refresh');
      });
    renderProvider(harness);
    await waitFor(() => expect(auth().accessToken).toBe('old-access'));
    events.length = 0;

    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get('Authorization');
      events.push(`fetch:${authorization}`);
      return authorization === 'Bearer new-access'
        ? apiSuccess({ recovered: true })
        : apiFailure(401, 'AUTHENTICATION_REQUIRED');
    });
    globalThis.fetch = fetchMock as typeof fetch;

    let result: unknown;
    await act(async () => {
      result = await apiRequest('/protected', { accessToken: 'old-access' });
    });

    expect(result).toEqual({ recovered: true });
    expect(harness.api.refresh).toHaveBeenCalledTimes(2);
    expect(harness.storedToken()).toBe('new-rotated-refresh');
    expect(auth().accessToken).toBe('new-access');
    expect(events.indexOf('set:new-rotated-refresh')).toBeLessThan(
      events.indexOf('fetch:Bearer new-access'),
    );
  });

  it('clears an invalid credential, starts anonymous safely, and never replays the mutation', async () => {
    const harness = createHarness('initial-refresh');
    harness.api.refresh
      .mockResolvedValueOnce(registeredBundle('registered-access', 'registered-refresh'))
      .mockRejectedValueOnce(new ApiError({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token',
      }));
    renderProvider(harness);
    await waitFor(() => expect(auth().accessToken).toBe('registered-access'));
    const fetchMock = jest.fn(async () => apiFailure(401, 'AUTHENTICATION_REQUIRED'));
    globalThis.fetch = fetchMock;

    let failure: unknown;
    await act(async () => {
      try {
        await apiRequest('/actor-owned-mutation', {
          method: 'POST',
          accessToken: 'registered-access',
          body: { clientSubmissionId: 'must-not-replay' },
        });
      } catch (error) {
        failure = error;
      }
    });

    expect(failure).toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.storage.clear).toHaveBeenCalledTimes(1);
    expect(harness.api.createAnonymous).toHaveBeenCalledTimes(1);
    expect(harness.storedToken()).toBe('anonymous-refresh');
    expect(auth().actor?.accountType).toBe('ANONYMOUS');
    expect(auth().errorMessage).toMatch(/session expired/i);
  });

  it.each([
    {
      name: 'network failure',
      error: new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Offline' }),
    },
    {
      name: 'refresh rate limit',
      error: new ApiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Try later' }),
    },
    {
      name: 'malformed refresh response',
      error: new ApiError({ status: 401, code: 'INVALID_API_RESPONSE', message: 'Malformed' }),
    },
  ])('preserves the authenticated session after a transient $name', async ({ error }) => {
    const harness = createHarness('initial-refresh');
    harness.api.refresh
      .mockResolvedValueOnce(registeredBundle('registered-access', 'registered-refresh'))
      .mockRejectedValueOnce(error);
    renderProvider(harness);
    await waitFor(() => expect(auth().accessToken).toBe('registered-access'));
    const fetchMock = jest.fn(async () => apiFailure(401, 'AUTHENTICATION_REQUIRED'));
    globalThis.fetch = fetchMock;

    let failure: unknown;
    await act(async () => {
      try {
        await apiRequest('/protected', { accessToken: 'registered-access' });
      } catch (caught) {
        failure = caught;
      }
    });

    expect(failure).toBe(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.storage.clear).not.toHaveBeenCalled();
    expect(harness.storedToken()).toBe('registered-refresh');
    expect(auth().accessToken).toBe('registered-access');
    expect(auth().actor?.accountType).toBe('REGISTERED');
  });

  it('does not publish or replay a refresh that completes after provider teardown', async () => {
    const harness = createHarness('initial-refresh');
    const lateRefresh = deferred<AuthTokenBundle>();
    harness.api.refresh
      .mockResolvedValueOnce(registeredBundle('registered-access', 'registered-refresh'))
      .mockImplementationOnce(() => lateRefresh.promise);
    const screen = renderProvider(harness);
    await waitFor(() => expect(auth().accessToken).toBe('registered-access'));
    const fetchMock = jest.fn(async () => apiFailure(401, 'AUTHENTICATION_REQUIRED'));
    globalThis.fetch = fetchMock;

    const requestPromise = apiRequest('/protected', { accessToken: 'registered-access' });
    await waitFor(() => expect(harness.api.refresh).toHaveBeenCalledTimes(2));
    screen.unmount();
    lateRefresh.resolve(registeredBundle('late-access', 'late-refresh'));

    await expect(requestPromise).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_RECOVERY_UNAVAILABLE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.storedToken()).toBe('late-refresh');
  });

  it('does not resurrect an authenticated identity when logout wins a refresh race', async () => {
    const harness = createHarness('initial-refresh');
    const lateRefresh = deferred<AuthTokenBundle>();
    harness.api.refresh
      .mockResolvedValueOnce(registeredBundle('registered-access', 'registered-refresh'))
      .mockImplementationOnce(() => lateRefresh.promise);
    renderProvider(harness);
    await waitFor(() => expect(auth().accessToken).toBe('registered-access'));
    const fetchMock = jest.fn(async () => apiFailure(401, 'AUTHENTICATION_REQUIRED'));
    globalThis.fetch = fetchMock;

    const requestPromise = apiRequest('/actor-owned-mutation', {
      method: 'POST',
      accessToken: 'registered-access',
      body: { clientSubmissionId: 'do-not-replay-after-logout' },
    });
    await waitFor(() => expect(harness.api.refresh).toHaveBeenCalledTimes(2));
    await act(async () => {
      await auth().logout();
    });
    lateRefresh.resolve(registeredBundle('late-access', 'late-refresh'));

    await expect(requestPromise).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_RECOVERY_UNAVAILABLE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.storedToken()).toBe('anonymous-refresh');
    expect(auth().actor?.accountType).toBe('ANONYMOUS');
    expect(auth().accessToken).toBe('anonymous-access');
  });
});

function AuthProbe() {
  const value = useAuth();
  React.useEffect(() => {
    latestAuth = value;
  }, [value]);
  return null;
}

function auth(): ReturnType<typeof useAuth> {
  if (!latestAuth) throw new Error('AuthProvider has not rendered');
  return latestAuth;
}

function renderProvider(harness: ReturnType<typeof createHarness>) {
  return render(
    <AuthProvider dependencies={{ api: harness.api, storage: harness.storage }}>
      <AuthProbe />
    </AuthProvider>,
  );
}

function createHarness(initialRefreshToken: string | null, events: string[] = []) {
  let storedRefreshToken = initialRefreshToken;
  const storage = {
    get: jest.fn(async () => storedRefreshToken),
    set: jest.fn(async (token: string) => {
      events.push(`set:${token}`);
      storedRefreshToken = token;
    }),
    clear: jest.fn(async () => {
      events.push('clear');
      storedRefreshToken = null;
    }),
  };
  const api = {
    createAnonymous: jest.fn(async () => anonymousBundle),
    register: jest.fn(async (_input: SignUpInput) => registeredBundle()),
    login: jest.fn(async (_input: SignInInput) => registeredBundle()),
    refresh: jest.fn(async (_refreshToken: string) => registeredBundle()),
    logout: jest.fn(async (_refreshToken: string) => ({ loggedOut: true as const })),
    me: jest.fn(async (accessToken: string) => (
      accessToken === anonymousBundle.accessToken ? anonymousActor : registeredActor
    )),
  };
  return { api, storage, storedToken: () => storedRefreshToken };
}

const registeredActor: AuthActor = {
  id: 'registered-user',
  accountType: 'REGISTERED',
  role: 'USER',
  status: 'ACTIVE',
  name: 'Registered User',
  createdAt: '2026-10-07T00:00:00.000Z',
};

const anonymousActor: AuthActor = {
  id: 'anonymous-user',
  accountType: 'ANONYMOUS',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-10-07T00:00:00.000Z',
};

const anonymousBundle: AuthTokenBundle = {
  accessToken: 'anonymous-access',
  refreshToken: 'anonymous-refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: anonymousActor,
};

function registeredBundle(
  accessToken = 'registered-access',
  refreshToken = 'registered-refresh',
): AuthTokenBundle {
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 900,
    user: registeredActor,
  };
}

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
