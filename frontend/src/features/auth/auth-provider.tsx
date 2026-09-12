import { createContext, type PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/src/services/api/errors';

import { authApi } from './auth-api';
import type {
  AuthActor,
  AuthOperation,
  AuthTokenBundle,
  SessionStatus,
  SignInInput,
  SignUpInput,
} from './auth.types';
import { refreshTokenStorage, type RefreshTokenStorage } from './session-storage';

interface AuthApi {
  createAnonymous(): Promise<AuthTokenBundle>;
  register(input: SignUpInput): Promise<AuthTokenBundle>;
  login(input: SignInInput): Promise<AuthTokenBundle>;
  refresh(refreshToken: string): Promise<AuthTokenBundle>;
  logout(refreshToken: string): Promise<{ loggedOut: true }>;
  me(accessToken: string): Promise<AuthActor>;
}

interface AuthDependencies {
  api: AuthApi;
  storage: RefreshTokenStorage;
}

interface AuthContextValue {
  status: SessionStatus;
  actor: AuthActor | null;
  accessToken: string | null;
  operation: AuthOperation;
  errorMessage: string | null;
  signIn(input: SignInInput): Promise<void>;
  signUp(input: SignUpInput): Promise<void>;
  logout(): Promise<void>;
  retry(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isInvalidRefresh(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.code === 'INVALID_REFRESH_TOKEN')
  );
}

export function AuthProvider({
  children,
  dependencies = { api: authApi, storage: refreshTokenStorage },
}: PropsWithChildren<{ dependencies?: AuthDependencies }>) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [actor, setActor] = useState<AuthActor | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [operation, setOperation] = useState<AuthOperation>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const started = useRef(false);

  async function activate(bundle: AuthTokenBundle): Promise<void> {
    const verifiedActor = await dependencies.api.me(bundle.accessToken);
    await dependencies.storage.set(bundle.refreshToken);
    setAccessToken(bundle.accessToken);
    setActor(verifiedActor);
    setErrorMessage(null);
    setStatus('ready');
  }

  async function createAnonymousSession(): Promise<void> {
    await activate(await dependencies.api.createAnonymous());
  }

  async function restoreSession(): Promise<void> {
    setStatus('loading');
    setErrorMessage(null);

    try {
      const refreshToken = await dependencies.storage.get();
      if (!refreshToken) {
        await createAnonymousSession();
        return;
      }

      try {
        await activate(await dependencies.api.refresh(refreshToken));
      } catch (error) {
        if (!isInvalidRefresh(error)) throw error;
        await dependencies.storage.clear();
        await createAnonymousSession();
      }
    } catch (error) {
      setAccessToken(null);
      setActor(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'HerPath could not restore your session. Please try again.',
      );
      setStatus('error');
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void restoreSession();
  });

  async function replaceSession(
    nextOperation: Exclude<AuthOperation, 'logout' | null>,
    createBundle: () => Promise<AuthTokenBundle>,
  ): Promise<void> {
    if (operation) return;
    setOperation(nextOperation);

    try {
      const previousRefreshToken = await dependencies.storage.get();
      const bundle = await createBundle();
      await activate(bundle);

      if (previousRefreshToken && previousRefreshToken !== bundle.refreshToken) {
        void dependencies.api.logout(previousRefreshToken).catch(() => undefined);
      }
    } finally {
      setOperation(null);
    }
  }

  async function signIn(input: SignInInput): Promise<void> {
    await replaceSession('signIn', () =>
      dependencies.api.login({ email: input.email.trim(), password: input.password }),
    );
  }

  async function signUp(input: SignUpInput): Promise<void> {
    await replaceSession('signUp', () =>
      dependencies.api.register({
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
      }),
    );
  }

  async function logout(): Promise<void> {
    if (operation) return;
    setOperation('logout');

    try {
      const refreshToken = await dependencies.storage.get();
      if (refreshToken) {
        await dependencies.api.logout(refreshToken).catch(() => undefined);
      }

      await dependencies.storage.clear();
      setAccessToken(null);
      setActor(null);
      setStatus('loading');
      await createAnonymousSession();
    } catch (error) {
      setAccessToken(null);
      setActor(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'HerPath could not create a new anonymous session. Please try again.',
      );
      setStatus('error');
    } finally {
      setOperation(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        actor,
        accessToken,
        operation,
        errorMessage,
        signIn,
        signUp,
        logout,
        retry: restoreSession,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
