const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

if (!configuredApiBaseUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL is required. Copy frontend/.env.example to frontend/.env and configure the URL for your device.',
  );
}

let parsedApiBaseUrl: URL;
try {
  parsedApiBaseUrl = new URL(configuredApiBaseUrl);
} catch {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.');
}

if (!['http:', 'https:'].includes(parsedApiBaseUrl.protocol)) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTP or HTTPS.');
}

export const environment = {
  apiBaseUrl: configuredApiBaseUrl.replace(/\/+$/, ''),
} as const;
