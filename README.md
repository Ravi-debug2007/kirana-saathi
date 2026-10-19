# Kirana Shop Manager

Android-first, offline-first tooling for Indian kirana counters. The repository is a TypeScript workspace with an Expo Router mobile app, a framework-independent domain package, and a Fastify AI gateway.

## Current status

This is a working foundation, not a claim of production completeness. Manual screens, paise-safe domain rules, an idempotent ledger boundary, versioned SQLite schema, order parsing, staff permission helpers, and a real provider connection-test route are present. The mobile screens still contain clearly labelled demo data and need repository wiring before they are a complete store-management product. See [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) for the feature-by-feature evidence and limitations.

## Prerequisites

- Node.js version in `.nvmrc` (currently 20.x).
- npm. No global packages are required.
- Android Studio/device for native camera, microphone, SQLite, and share verification.

## Setup

```sh
npm ci
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
```

Provider keys are optional for local manual work. Never put them in the mobile app or commit `.env`.

## Run the mobile app

```sh
npm start
# then press a, or use:
npm run android
```

The web target is useful for UI iteration but cannot prove native camera, microphone, or SQLite behaviour.

## Run the gateway

```sh
npm run api:dev
```

Endpoints currently available:

- `GET /health`
- `POST /v1/quotes` — deterministic paise quote calculation
- `POST /v1/providers/test` — makes a real minimal request to Gemini, Groq, OpenRouter, Cerebras, or a custom OpenAI-compatible endpoint. Configure `AI_GATEWAY_AUTH_TOKEN` to require a bearer token.

The API route returns categorized provider failures (credentials, unsupported endpoint/model, rate limit, network, or provider error) and never echoes the key.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

`npm test` is offline and currently covers money, sales, inventory idempotency, Udhaar, order transitions, product matching, parsing, pricing suggestions, and permission audits. `npm run typecheck` validates domain, API, and mobile TypeScript. Native E2E tests are not runnable without an Android device/emulator.

## Project map

- `app/` — Expo Router screens and navigation.
- `src/components/` — accessible reusable mobile controls.
- `src/lib/database.ts` — versioned `expo-sqlite` schema and transaction boundary.
- `src/lib/storage.ts` — local persistence abstraction and web/dev fallback.
- `packages/domain/` — business rules; no React Native dependency.
- `packages/api/` — Fastify gateway and server-side provider test adapters.
- `PROJECT.md`, `ARCHITECTURE.md`, `TASKS.md`, `IMPLEMENTATION_STATUS.md` — scope, design, work queue, and honest evidence.

## Docker

The Dockerfile installs dependencies inside the project container and typechecks the workspace. It is suitable for the gateway/build environment; Android builds still require the Android toolchain or Expo's development workflow.

```sh
docker build -t kirana-shop-manager .
docker run --rm -p 3000:3000 --env-file .env kirana-shop-manager
```
