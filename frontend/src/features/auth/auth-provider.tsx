import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { registerAuthRecovery } from '@/src/services/api/auth-recovery';
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
const SESSION_EXPIRED_MESSAGE = 'Your session expired. HerPath started a new anonymous session.';

function isInvalidRefresh(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'INVALID_REFRESH_TOKEN'
  );
}

export function AuthProvider({
  children,
  dependencies,
}: PropsWithChildren<{ dependencies?: AuthDependencies }>) {
  const api = dependencies?.api ?? authApi;
  const storage = dependencies?.storage ?? refreshTokenStorage;
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [actor, setActor] = useState<AuthActor | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [operation, setOperation] = useState<AuthOperation>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const started = useRef(false);
  const mounted = useRef(false);
  const sessionRevision = useRef(0);
  const restorePromise = useRef<Promise<void> | null>(null);

  const activate = useCallback(async function activate(
    bundle: AuthTokenBundle,
    options: { persistBeforeVerification?: boolean; noticeMessage?: string } = {},
  ): Promise<void> {
    if (options.persistBeforeVerification) {
      await storage.set(bundle.refreshToken);
    }
    const verifiedActor = await api.me(bundle.accessToken);
    if (!options.persistBeforeVerification) {
      await storage.set(bundle.refreshToken);
    }
    if (!mounted.current) return;
    setAccessToken(bundle.accessToken);
    setActor(verifiedActor);
    setErrorMessage(options.noticeMessage ?? null);
    setStatus('ready');
  }, [api, storage]);

  const createAnonymousSession = useCallback(async function createAnonymousSession(
    noticeMessage?: string,
  ): Promise<void> {
    await activate(await api.createAnonymous(), noticeMessage ? { noticeMessage } : {});
  }, [activate, api]);

  const transitionAfterTerminalRefreshFailure = useCallback(async function transitionAfterTerminalRefreshFailure(
    cause: unknown,
    expectedRevision: number,
  ): Promise<never> {
    if (sessionRevision.current !== expectedRevision) throw authRecoveryUnavailableError();
    sessionRevision.current += 1;
    await storage.clear();
    if (!mounted.current) throw sessionExpiredError(cause);

    setAccessToken(null);
    setActor(null);
    setStatus('loading');
    setErrorMessage(SESSION_EXPIRED_MESSAGE);

    try {
      await createAnonymousSession(SESSION_EXPIRED_MESSAGE);
    } catch {
      if (mounted.current) {
        setAccessToken(null);
        setActor(null);
        setStatus('error');
        setErrorMessage(SESSION_EXPIRED_MESSAGE);
      }
    }

    throw sessionExpiredError(cause);
  }, [createAnonymousSession, storage]);

  const recoverRuntimeAccessToken = useCallback(async function recoverRuntimeAccessToken(): Promise<string> {
    const recoveryRevision = sessionRevision.current;
    const currentRefreshToken = await storage.get();
    if (!currentRefreshToken) {
      return transitionAfterTerminalRefreshFailure(undefined, recoveryRevision);
    }

    let bundle: AuthTokenBundle;
    try {
      bundle = await api.refresh(currentRefreshToken);
    } catch (error) {
      if (isInvalidRefresh(error)) {
        return transitionAfterTerminalRefreshFailure(error, recoveryRevision);
      }
      throw error;
    }

    if (sessionRevision.current !== recoveryRevision) throw authRecoveryUnavailableError();
    await storage.set(bundle.refreshToken);
    if (!mounted.current || sessionRevision.current !== recoveryRevision) {
      throw authRecoveryUnavailableError();
    }

    setAccessToken(bundle.accessToken);
    setActor(bundle.user);
    setErrorMessage(null);
    setStatus('ready');
    return bundle.accessToken;
  }, [api, storage, transitionAfterTerminalRefreshFailure]);

  async function performSessionRestore(): Promise<void> {
    setStatus('loading');
    setErrorMessage(null);

    try {
      const refreshToken = await storage.get();
      if (!refreshToken) {
        await createAnonymousSession();
        return;
      }

      let bundle: AuthTokenBundle;
      try {
        bundle = await api.refresh(refreshToken);
      } catch (error) {
        if (!isInvalidRefresh(error)) {
          throw error;
        }
        await storage.clear();
        await createAnonymousSession();
        return;
      }

      await activate(bundle, { persistBeforeVerification: true });
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

  async function restoreSession(): Promise<void> {
    if (restorePromise.current) {
      return restorePromise.current;
    }

    const promise = performSessionRestore();
    restorePromise.current = promise;

    try {
      await promise;
    } finally {
      if (restorePromise.current === promise) {
        restorePromise.current = null;
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    const unregister = registerAuthRecovery({
      recoverAccessToken: recoverRuntimeAccessToken,
    });

    return () => {
      mounted.current = false;
      unregister();
    };
  }, [recoverRuntimeAccessToken]);

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
    sessionRevision.current += 1;
    setOperation(nextOperation);

    try {
      const previousRefreshToken = await storage.get();
      const bundle = await createBundle();
      await activate(bundle);

      if (previousRefreshToken && previousRefreshToken !== bundle.refreshToken) {
        void api.logout(previousRefreshToken).catch(() => undefined);
      }
    } finally {
      setOperation(null);
    }
  }

  async function signIn(input: SignInInput): Promise<void> {
    await replaceSession('signIn', () =>
      api.login({ email: input.email.trim(), password: input.password }),
    );
  }

  async function signUp(input: SignUpInput): Promise<void> {
    await replaceSession('signUp', () =>
      api.register({
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
      }),
    );
  }

  async function logout(): Promise<void> {
    if (operation) return;
    sessionRevision.current += 1;
    setOperation('logout');

    try {
      const refreshToken = await storage.get();
      if (refreshToken) {
        await api.logout(refreshToken).catch(() => undefined);
      }

      await storage.clear();
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

function sessionExpiredError(cause: unknown): ApiError {
  return new ApiError({
    status: 401,
    code: 'SESSION_EXPIRED',
    message: SESSION_EXPIRED_MESSAGE,
    cause,
  });
}

function authRecoveryUnavailableError(): ApiError {
  return new ApiError({
    status: 401,
    code: 'AUTH_RECOVERY_UNAVAILABLE',
    message: 'Your session could not be refreshed. Please try again.',
  });
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
