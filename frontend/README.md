# HerPath Mobile

Expo SDK 54 mobile shell for HerPath. PR 4 provides native session restoration, anonymous-first access, registered authentication, role-aware navigation, and placeholders for the five agreed feature tabs.

## Requirements

- Node.js 20.19 or newer
- npm
- Expo Go or an Android development build
- The HerPath backend running and reachable from the device

## Setup

```bash
cd frontend
npm ci
Copy-Item .env.example .env
npx expo start
```

`EXPO_PUBLIC_API_BASE_URL` is compiled into the client and must contain the complete `/api/v1` base URL. It is public configuration, never a place for secrets.

## Development API URL

Choose the URL that is reachable from the client running Expo:

- Web or desktop browser: `http://localhost:4000/api/v1`
- Standard Android Studio emulator: `http://10.0.2.2:4000/api/v1`
- Physical Android device: `http://<development-computer-LAN-IP>:4000/api/v1`

For a physical device, the phone and development computer must normally share a network, and the backend/firewall must allow the connection. Put the developer-specific address only in `frontend/.env`; never commit it. `localhost` on an emulator or phone points to that device, not necessarily the development computer.

## Session model

- Access token: held in React memory only
- Refresh token: stored in Expo SecureStore on native Android/iOS
- Actor: held in memory and verified through `/auth/me`
- Passwords and signing secrets: never stored by the app

Startup restores and rotates a stored refresh token. With no stored token, or after an invalid/revoked token is cleared, the app creates a fresh anonymous session. Network failures show a retry screen rather than starting a refresh loop.

Signing in or registering replaces the anonymous session. Logging out attempts backend revocation, clears local session material, and creates a new anonymous session so the main app remains usable.

Web refresh-token persistence is intentionally not provided in the first assessed milestone.

## Routes

```text
app/
├── _layout.tsx
├── index.tsx
├── (auth)/
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── (tabs)/
│   ├── map.tsx
│   ├── routes.tsx
│   ├── report.tsx
│   ├── alerts.tsx
│   └── profile.tsx
└── moderator/
    └── index.tsx
```

The moderator route uses the actor role returned by the backend. This navigation guard is a UX boundary only; backend authorization remains mandatory.

## Validation

```bash
npx expo install --check
npx expo-doctor
npx tsc --noEmit
npx eslint .
```

The frontend currently has no automated test framework. Authentication APIs, storage, validation, and provider dependencies are separated so focused tests can be added without coupling them to route files.
