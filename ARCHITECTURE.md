# Architecture

```text
Expo Router mobile app
  ├─ screens/components (busy-counter UI)
  ├─ local repositories (SQLite boundary; AsyncStorage fallback for web/dev)
  ├─ input adapters (paste, speech, barcode)
  └─ shared domain rules (paise, drafts, inventory, Udhaar, permissions)
                 │ HTTPS / authenticated requests
Fastify gateway
  ├─ validated HTTP routes
  ├─ provider adapters (Gemini, Groq, OpenRouter, Cerebras, custom OpenAI-compatible)
  └─ server-side provider configuration and redacted operational metadata
```

## Invariants

1. All monetary calculations use integer paise.
2. A draft does not write a sale or inventory movement.
3. A confirmed sale is idempotent by operation key and its inventory movement is compensating/auditable.
4. AI can propose product matches and quantities, but application logic calculates totals and requires review.
5. Provider secrets are server-side only; logs must not contain keys or customer ledgers.

## Persistence direction

The mobile repository boundary is ready for versioned `expo-sqlite` migrations. The current web/dev fallback uses AsyncStorage so screens can be exercised without a native build. Production persistence should use SQLite tables for products, bills, bill_lines, inventory_movements, customers, udhaar_entries, orders, staff, and audit_records, with idempotency keys unique per operation.
