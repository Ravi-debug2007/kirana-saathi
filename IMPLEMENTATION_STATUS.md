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
- `npm start` — fixed: Expo SDK 52 requires the top-level `expo-asset` package; added `expo-asset@~11.0.5` and validated the resolved Expo config.
- `npm run android` — prebuild completed and generated `android/`; the first attempt stopped because no Android device or emulator was connected/available. After starting the existing AVD, the next attempt reached Gradle and exposed the JDK compatibility blocker below.
- Android emulator setup — an existing `api26` AVD was started successfully; hardware acceleration is available through WHPX and `adb devices` reported `emulator-5554` as ready. The native build then remained blocked by the installed JDK 27: Gradle 8.10.2/this Expo Android toolchain rejects class-file major version 71. A JDK 17–23 installation is required for `npm run android`.
- JDK 21 was installed with Microsoft OpenJDK and Expo package versions were aligned with SDK 52 using `npx expo install --fix`.
- Native Android build — passed with JDK 21: Gradle assembled `android/app/build/outputs/apk/debug/app-debug.apk`.
- APK install — passed on the `api26` emulator with `adb install -r`; package `com.anonymous.kiranasaathi` launched successfully and reached `MainActivity`.
- JS runtime smoke test — incomplete: the emulator lost its connection while Metro was not reachable through `10.0.2.2:8081`; the app logged the standard development-bundle loading error. The APK/native shell itself launched without a native crash.

## Next task

Add product creation/editing and customer-selection screens, then connect persisted bill history, Udhaar UI, and correction/reversal workflows.
