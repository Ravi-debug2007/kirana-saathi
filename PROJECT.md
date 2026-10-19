# Kirana Shop Manager

## Product goal

An Android-first, offline-first assistant for Indian kirana shopkeepers. The first useful flow is: open the app, add a catalogue product, create a manual bill, confirm it, and see the stock decrease exactly once. Paste and voice input produce editable drafts; they never create a sale by themselves.

## Users and assumptions

- Primary user: a shopkeeper at a busy counter, using a phone with large touch targets.
- Initial interface languages: English with Telugu/Hindi-ready strings and product aliases.
- Essential billing, inventory, customers, and Udhaar work locally without an AI key.
- Provider credentials belong to the Fastify gateway, never the distributed app.

## Current delivery

The repository is a TypeScript workspace containing an Expo Router mobile shell, a shared domain package, and a Fastify gateway. The domain package is intentionally independent of React Native so its money and ledger rules can be tested offline.
