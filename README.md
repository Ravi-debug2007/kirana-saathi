# Shopkeeper mobile foundation

An Expo Router + React Native TypeScript shell for a local-first shopkeeper app. It includes a practical tab navigation shell, accessible reusable UI primitives, dashboard, products, new bill, orders, Udhaar, inventory and settings screens.

## Run

```sh
npm install
npx expo start
npm run typecheck
```

## Architecture notes

- `src/components/ui.tsx` contains small, accessible primitives (`Button`, `Field`, `Row`, `Card`, `Screen`) with consistent touch targets and labels.
- `src/lib/storage.ts` is the local persistence boundary. AsyncStorage is used for web/dev compatibility; `expo-sqlite` is installed and configured for native builds, but schema/migrations and backend synchronization intentionally remain outside this mobile foundation.
- Barcode capture uses `expo-camera` and explicitly renders permission, denied, scanning, and captured states.
- Quick entry provides paste and speech-preview adapters with empty/error status states. A real speech-to-text provider can be injected later without changing billing/domain logic.
- Mock data is isolated in `src/data/mock.ts`; no backend domain logic is duplicated.

## Known limitation

Native camera and SQLite behavior must be verified in an Expo development build or device. The web target falls back to the permission/manual-entry path and AsyncStorage adapter.
