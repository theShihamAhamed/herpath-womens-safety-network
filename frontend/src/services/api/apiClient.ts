// frontend/src/services/apiClient.ts
// Shared axios instance for all backend calls. If one already exists here,
// reuse it instead and skip this file — routingApi.ts just needs an
// axios instance pointed at your backend base URL.

import { create } from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export const apiClient = create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

// If auth tokens are attached elsewhere (e.g. an interceptor in the auth
// feature), make sure this shared instance is the one auth's interceptor
// is registered on — don't create a second, un-authenticated instance.
