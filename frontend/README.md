# HerPath Mobile

Expo SDK 57 React Native application for privacy-conscious incident reporting, community safety context, route comparison, and active journey outcomes. The current validated build includes anonymous-first and registered authentication, the three-tab shell (Map, Report, Profile), incident/community/moderation flows, route comparison, journey tracking, and local journey notifications.

## Requirements

- Node.js 22 or newer
- npm
- Expo Go or an Android development build
- The HerPath backend running and reachable from the device

## Setup

```bash
cd frontend
npm ci
Copy-Item .env.example .env
npm run start
```

`EXPO_PUBLIC_API_BASE_URL` is compiled into the client and must contain the complete `/api/v1` base URL. It is public configuration, never a place for secrets. Geoapify remains backend-only; the mobile client does not contain a provider credential.

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
├── (auth)/sign-in.tsx, sign-up.tsx
├── (tabs)/map.tsx, report.tsx, profile.tsx
├── alerts.tsx
├── journey/{intro,route-comparison,tracking,[id],outcome,history,analytics}.tsx
└── moderator/{index,cases/[caseId]/{index,decision,audits}}.tsx
```

The moderator route uses the actor role returned by the backend. This navigation guard is a UX boundary only; backend authorization remains mandatory.

## Validation

```bash
npm run expo:check
npm run typecheck
npm run lint
npm run test:ci
```

The remote frontend gate at the M7/M8 completion SHA reports 11 Jest suites and 63 tests. The backend gate reports 34 test files and 323 tests. Use `npx --no-install` for one-off local Expo checks so validation cannot install packages.

## Maps and native builds

In Expo Go, HerPath renders imagery through `MapView mapType="none"` and `UrlTile` against the backend `/api/v1/map/tiles/*` proxy. Geoapify credentials stay on the backend. A custom Android binary using `react-native-maps` additionally requires a separate Google Maps Android SDK key restricted to the package and signing SHA-1; that native credential is not present in this repository, so custom Android build verification is deferred.

## Journey and privacy scope

Journey start requires consent and foreground location permission before the backend start request; the returned journey identifier is stored before the watcher begins. Finish, cancel, and expiry complete the journey, default an unresolved outcome to `UNKNOWN`, and purge raw path/check-in/deviation coordinates while retaining aggregate history. Local deviation and fallback-channel notifications are implemented; remote Safety Updates push delivery remains outside this completion scope.
