# HerPath Backend

Production-conscious Express and TypeScript foundation for the HerPath REST API. The backend is an independent npm project and exposes all application endpoints under `/api/v1`.

PR 2 intentionally contains shared infrastructure only. Authentication, incidents, maps, routes, journeys, notifications, and application models belong to later feature PRs.

## Architecture

```text
src/
├── app.ts                 Express construction and route registration
├── server.ts              Environment validation, MongoDB, HTTP lifecycle
├── config/                Environment, database, and logger configuration
└── common/
    ├── errors/            Operational error abstraction
    ├── middleware/        Request ID, security, validation, limits, errors
    ├── types/             Shared API envelope types
    └── utils/             API response helpers
```

`app.ts` does not open a port. `server.ts` is the process entry point and owns startup and graceful shutdown. This separation allows Supertest to exercise the Express app without a live network listener or MongoDB instance.

## Requirements

- Node.js 22 or newer
- npm
- MongoDB Atlas or another compatible MongoDB deployment

## Installation

```bash
cd backend
npm ci
```

## Environment setup

Copy `.env.example` to `.env`, then provide a real `MONGODB_URI` locally. Never commit `.env` or credentials.

```bash
Copy-Item .env.example .env
```

`CORS_ORIGINS` accepts a comma-separated allowlist. Production deployments must configure their actual origins rather than relying on the development example.

## Commands

```bash
npm run dev        # Watch and run src/server.ts with tsx
npm run build      # Compile production JavaScript into dist/
npm start          # Run the compiled server
npm run typecheck  # Type-check without emitting files
npm run lint       # Run ESLint with zero warnings allowed
npm test           # Run the Vitest suite once
npm run test:watch # Run Vitest in watch mode
```

## Health endpoint

`GET /api/v1/health`

When MongoDB is connected:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected"
  },
  "meta": {}
}
```

If MongoDB is unavailable, the endpoint returns HTTP 503 using the standard API error envelope without exposing driver details.

## Project conventions

- Keep route files thin and move reusable behavior into modules or shared infrastructure.
- Validate external input with Zod and the shared validation middleware.
- Return responses through the shared success/error helpers.
- Throw `AppError` for expected operational HTTP failures.
- Never log secrets, authorization headers, private incident coordinates, or journey location data.
- Do not add empty feature folders. Add a module only with its real implementation.
- Update relevant files in `docs/` whenever a PR changes an API, architecture, domain, privacy, or cross-component contract.
