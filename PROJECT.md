# KiranaSaathi — Voice-First AI for Kirana Stores

**Track:** Agents & Automation

## Project description

KiranaSaathi is an AI-powered, voice-first shop management app designed for Indian kirana stores. Shopkeepers can speak naturally in Telugu, Hindi, English, or mixed languages, or paste customer orders from WhatsApp, to create editable bills in seconds. The app connects billing with live inventory, automatically tracks stock after confirmed sales, simplifies restocking, and manages customer Udhaar, payments, suppliers, and daily sales reports. It uses the shop's saved product catalogue and prices, while keeping shopkeepers in control of bill edits and confirmations. A modular AI provider system allows users to configure API keys, test connections, and switch between supported AI models. The goal is to make digital billing and inventory management accessible, practical, and fast for small Indian businesses.

## Product goal

An Android-first, offline-first assistant for Indian kirana shopkeepers. The first useful flow is: open the app, add a catalogue product, create a manual bill, confirm it, and see the stock decrease exactly once. Paste and voice input produce editable drafts; they never create a sale by themselves.

## Users and assumptions

- Primary user: a shopkeeper at a busy counter, using a phone with large touch targets.
- Initial interface languages: English with Telugu/Hindi-ready strings and product aliases.
- Essential billing, inventory, customers, and Udhaar work locally without an AI key.
- Provider credentials belong to the Fastify gateway, never the distributed app.

## Current delivery

The repository is a TypeScript workspace containing an Expo Router mobile shell, a shared domain package, and a Fastify gateway. The domain package is intentionally independent of React Native so its money and ledger rules can be tested offline.
