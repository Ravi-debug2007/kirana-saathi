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

## Implemented but not fully tested

- Mobile UI and local storage boundary. Native SQLite, camera, microphone and sharing need an Android development build.
- Provider test route and HTTP client. No live provider request was run because no credentials are configured.

## Partial / blocked

- Mobile screens still use demo data and do not yet persist real product/bill workflows through SQLite.
- Gateway does not yet expose authenticated provider configuration, model discovery, connection testing, or durable metadata.
- No emulator/device is available in this workspace, so E2E and real voice/barcode/camera checks are unavailable.
- No production synchronization service, deployment, or messaging integration is configured.

## Actual checks

- `npm install` — completed during bootstrap.
- `npm run typecheck` — passed on 2026-10-20 (domain, API, and mobile TypeScript).
- `npm run build` — passed on 2026-10-20.
- `npm test` — passed on 2026-10-20: 10 tests across domain and API suites.

## Next task

Implement SQLite schema/repositories and connect the new-bill and inventory flows so a confirmed sale persists and deducts stock exactly once.
