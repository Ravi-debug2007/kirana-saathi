# Final feature audit (2026-10-20)

This audit distinguishes code that exists from a complete, device-verified product. Evidence refers to the current repository and the commands actually run: `npm test` (10 passing tests), `npm run typecheck`, and `npm run build` (all passed). No Android emulator, provider credentials, deployment, or messaging credentials were available.

| Area | Status | Evidence / limitation |
|---|---|---|
| Expo Router Android-first shell and accessible controls | Implemented but not fully tested | `app/`, `src/components/ui.tsx`; TypeScript passed, native layout not device-tested. |
| Product catalogue fields, aliases, safe prices, units, archive | Partially implemented | `packages/domain/src/index.ts` validates the model; `app/(tabs)/products.tsx` is a demo screen; no connected CRUD repository yet. |
| Manual billing, deterministic totals, price overrides, drafts | Partially implemented | `confirmSale` and tests cover totals/payment; `app/bill/new.tsx` still uses demo line data and does not persist a real draft. |
| Confirmed sale inventory deduction exactly once | Partially implemented | `InventoryLedger` idempotency test passes; SQLite tables exist; UI/service transaction wiring is not complete. |
| Restock, returns, correction/reversal ledger | Partially implemented | Inventory reason types and schema exist; no complete screen/service flow or integration test. |
| Paste-message and voice parsing | Partially implemented | `parseOrderText`, aliases, uncertainty, and `app/tools/voice.tsx` exist; speech provider and persisted editable draft are not wired. |
| AI provider manager and real connection test | Implemented but not fully tested | `packages/api/src/providers.ts`, `/v1/providers/test`; request classification is tested only for gateway auth/quotes, no live credential call was possible. |
| Price suggestions | Implemented and tested | `suggestPrice` rounds a cost-plus estimate; it is a function only and is not automatically applied. A trustworthy live market source is not configured. |
| Customer order statuses/history | Partially implemented | Exact status transition rules and SQLite history tables exist; screens/services do not yet persist status history. |
| Barcode scanning and barcode registration | Partially implemented | `app/tools/scan.tsx` and `expo-camera` permission states exist; catalogue matching/registration and device scan are not verified. |
| Staff accounts, permissions, audit | Partially implemented | `can`/`audit` rules and audit schema exist; no account management UI/authentication or backend enforcement for every mutation yet. |
| Customer communication/shareable receipts | Partially implemented | Messaging interface exists and mobile shell can be extended; no delivery-confirming integration or receipt/share flow is wired. |
| Udhaar customers, credit sales, partial payments, corrections | Partially implemented | `UdhaarLedger` and tests cover a partial payment; customer UI is demo-only and durable correction workflow is pending. |
| Suppliers and purchases | Not implemented | No supplier/purchase repository or screen yet. |
| Dashboard and reports | Partially implemented | Dashboard exists with demo metrics; no report queries from durable records or verified-vs-estimate profit report. |
| Receipts, history, exports/restore | Not implemented | Schema groundwork exists, but export/restore and correction receipt workflows are pending. |
| Offline persistence, migrations, recovery, sync | Partially implemented | `src/lib/database.ts` has a versioned schema and idempotent movement insert; full repositories, recovery tests, and cloud sync are pending. |
| Security and secret handling | Implemented but not fully tested | `.env.example`, bearer gateway guard, redacted Fastify logger, and server-side provider route exist; production HTTPS/encryption/rate limits/deployment are not configured. |
| Unit/API/E2E testing | Partially implemented | 10 offline unit/API tests pass; no Android E2E or live-provider tests were available. |

## Genuine blockers

1. Android emulator or physical device is required to verify Expo camera, microphone, SQLite, permissions, receipt sharing, and screen-size behaviour.
2. Provider API keys and an HTTPS deployment are required to run live Gemini/Groq/OpenRouter/Cerebras connection tests.
3. A messaging provider account and permission grant are required to prove delivery rather than merely queueing a message.

The next concrete implementation step is to add SQLite repositories and connect product, bill, inventory, and Udhaar screens to them, then add persistence/restart integration tests.
