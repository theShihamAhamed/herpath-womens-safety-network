import { apiRequest } from '@/src/services/api/client';
import { apiEndpoints } from '@/src/services/api/endpoints';

import type { AuthActor, AuthTokenBundle, SignInInput, SignUpInput } from './auth.types';

export const authApi = {
  createAnonymous(): Promise<AuthTokenBundle> {
    return apiRequest(apiEndpoints.auth.anonymous, { method: 'POST' });
  },

  register(input: SignUpInput): Promise<AuthTokenBundle> {
    return apiRequest(apiEndpoints.auth.register, { method: 'POST', body: input });
  },

  login(input: SignInInput): Promise<AuthTokenBundle> {
    return apiRequest(apiEndpoints.auth.login, { method: 'POST', body: input });
  },

  refresh(refreshToken: string): Promise<AuthTokenBundle> {
    return apiRequest(apiEndpoints.auth.refresh, {
      method: 'POST',
      body: { refreshToken },
    });
  },

  logout(refreshToken: string): Promise<{ loggedOut: true }> {
    return apiRequest(apiEndpoints.auth.logout, {
      method: 'POST',
      body: { refreshToken },
    });
  },

  async me(accessToken: string): Promise<AuthActor> {
    const data = await apiRequest<{ user: AuthActor }>(apiEndpoints.auth.me, {
      method: 'GET',
      accessToken,
    });
    return data.user;
  },
};
