export const apiEndpoints = {
  auth: {
    anonymous: '/auth/anonymous',
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
  },

  map: {
    incidents: '/map/incidents',
    areaSummary: '/map/area-summary',
  },

  journeys: {
    start: '/journeys/start',
    location: '/journeys/location',
    checkin: '/journeys/checkin',
    deviation: '/journeys/deviation',
    finish: '/journeys/finish',
    outcome: '/journeys/outcome',
    history: '/journeys/history',
    byId: (id: string) => `/journeys/${id}`,
  },

  analytics: {
    summary: '/analytics/summary',
  },

  incidents: {
    create: '/incidents',
    locationCells: '/incidents/location-cells',
    mine: '/incidents/mine',
  },

  moderation: {
    cases: '/moderation/cases',
    caseById: (caseId: string) => `/moderation/cases/${encodeURIComponent(caseId)}`,
    audits: (caseId: string) =>
      `/moderation/cases/${encodeURIComponent(caseId)}/audits`,
    claim: (caseId: string) =>
      `/moderation/cases/${encodeURIComponent(caseId)}/claim`,
    release: (caseId: string) =>
      `/moderation/cases/${encodeURIComponent(caseId)}/release`,
    reopen: (caseId: string) =>
      `/moderation/cases/${encodeURIComponent(caseId)}/reopen`,
  },

  routes: {
    search: '/routes/destinations/search',
  },
} as const;
