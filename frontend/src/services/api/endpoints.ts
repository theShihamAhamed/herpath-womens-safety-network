export const apiEndpoints = {
  auth: {
    anonymous: '/auth/anonymous',
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
  },
} as const;
