# Implementation status

Updated: 2026-10-20

## Completed and tested

- TypeScript workspace and pinned Node runtime (`.nvmrc`).
- Integer-paise money formatting and deterministic bill totals.
- Product validation and selling-price changes.
- Billing confirmation rejects empty bills, invalid quantities, mismatched payments, and missing idempotency keys.
- In-memory inventory and Udhaar ledger primitives with duplicate-entry protection.
- Order transition rules, price-suggestion rounding, staff permission/audit helper.
- Fastify health and quote route source.
- Fastify bearer protection and real provider connection-test route for Gemini, Groq, OpenRouter, Cerebras, and custom OpenAI-compatible endpoints.
- Expo Router screens for dashboard, products, orders, Udhaar, inventory, new bill, barcode and quick voice/paste entry.
- Versioned SQLite schema with products, bills, bill lines, inventory movements, customers, Udhaar, orders, history, and audit records.
- SQLite repository layer for products, bills, customers, Udhaar, audit records, and atomic sale confirmation with stock checks, idempotency, rollback, and correction records.
- The new-bill and products screens now read the saved local catalogue and create/confirm real local bills on native SQLite builds.
- QuestUI visual tokens and shared dark/gold components are applied to the dashboard, products, billing, orders, Udhaar, inventory, barcode, voice, settings, and navigation surfaces.

## Implemented but not fully tested

- Mobile UI and local storage boundary. Native SQLite, camera, microphone and sharing need an Android development build.
- QuestUI typography is currently represented with platform serif fallbacks; Cinzel, Spectral, and Fira Code font assets were not present in the repository and need Android font rendering verification before bundling.
- Provider test route and HTTP client. No live provider request was run because no credentials are configured.

## Partial / blocked

- Dashboard, orders, Udhaar, inventory, and settings screens still use demo data; product listing and new billing now use SQLite repositories.
- Gateway does not yet expose authenticated provider configuration, model discovery, connection testing, or durable metadata.
- No emulator/device is available in this workspace, so E2E and real voice/barcode/camera checks are unavailable.
- No production synchronization service, deployment, or messaging integration is configured.

## Actual checks

- `npm install` — completed during bootstrap.
- `npm run typecheck` — passed on 2026-10-20 (domain, API, and mobile TypeScript).
- `npm run build` — passed on 2026-10-20.
- `npm test` — passed on 2026-10-20: 15 tests across domain, SQLite repository, and API suites.
- `npx vitest run src/lib/repositories.test.ts` — passed: 5 temporary in-memory SQLite integration tests.
- `npx expo export --platform web` — blocked: `react-native-web@~0.19.13` is not installed; no dependency was added because this milestone targets Android and native UI verification still requires an Android build.

## Next task

Add product creation/editing and customer-selection screens, then connect persisted bill history, Udhaar UI, and correction/reversal workflows.
