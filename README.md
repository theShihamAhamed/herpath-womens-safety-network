# HerPath – Women's Safety Reporting & Safe-Route Network

HerPath is an Android-first React Native mobile application for privacy-conscious incident reporting, community safety context, route comparison, and active journey outcomes.

HerPath provides safety context based on available community data. It does not guarantee that a route or place is safe.

## Repository structure

```text
frontend/  Expo SDK 54 React Native application
backend/   Backend placeholder; initialization is planned for PR 2
docs/      Implementation documentation baseline
```

The frontend and backend are independent npm projects.

## Frontend development

```bash
cd frontend
npm ci
npx expo start
```

## Backend development

The backend is not initialized yet. See [backend/README.md](backend/README.md).

## Documentation

Start with [docs/README.md](docs/README.md). Architecture, API, domain, privacy, navigation, and cross-component contract changes must update the relevant documentation in the same pull request.
