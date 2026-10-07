import { ApiError } from './errors';

export interface AuthRecoveryHandler {
  recoverAccessToken(): Promise<string>;
}

interface Registration {
  id: number;
  handler: AuthRecoveryHandler;
}

interface InFlightRecovery {
  registrationId: number;
  promise: Promise<string>;
}

let nextRegistrationId = 1;
let activeRegistration: Registration | null = null;
let inFlightRecovery: InFlightRecovery | null = null;

export function registerAuthRecovery(handler: AuthRecoveryHandler): () => void {
  const registration: Registration = { id: nextRegistrationId, handler };
  nextRegistrationId += 1;
  activeRegistration = registration;

  return () => {
    if (activeRegistration?.id === registration.id) activeRegistration = null;
  };
}

export function isAuthRecoveryAvailable(): boolean {
  return activeRegistration !== null;
}

export function recoverAccessToken(): Promise<string> {
  const registration = activeRegistration;
  if (!registration) {
    return Promise.reject(recoveryUnavailableError());
  }

  if (inFlightRecovery?.registrationId === registration.id) {
    return inFlightRecovery.promise;
  }

  const promise = registration.handler.recoverAccessToken().then((accessToken) => {
    if (activeRegistration?.id !== registration.id) throw recoveryUnavailableError();
    return accessToken;
  });

  inFlightRecovery = { registrationId: registration.id, promise };
  void promise.finally(() => {
    if (inFlightRecovery?.promise === promise) inFlightRecovery = null;
  }).catch(() => undefined);

  return promise;
}

function recoveryUnavailableError(): ApiError {
  return new ApiError({
    status: 401,
    code: 'AUTH_RECOVERY_UNAVAILABLE',
    message: 'Your session could not be refreshed. Please try again.',
  });
}
