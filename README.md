# HerPath – Women's Safety Reporting & Safe-Route Network

HerPath is an Android-first React Native mobile application for privacy-conscious incident reporting, community safety context, route comparison, and active journey outcomes.

HerPath provides safety context based on available community data. It does not guarantee that a route or place is safe.

## Repository structure

```text
frontend/  Expo SDK 54 React Native application
backend/   Express and TypeScript API
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

```bash
cd backend
npm ci
Copy-Item .env.example .env
npm run dev
```

Provide a valid `MONGODB_URI` in `backend/.env` before starting the server. See [backend/README.md](backend/README.md) for architecture, environment variables, commands, and conventions.

## Documentation

Start with [docs/README.md](docs/README.md). Architecture, API, domain, privacy, navigation, and cross-component contract changes must update the relevant documentation in the same pull request.
