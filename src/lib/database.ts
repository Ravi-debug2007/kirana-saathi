import { Platform } from 'react-native';
import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';

/** Versioned, local-first schema. Money is stored as integer paise and stock as integer base units. */
export const SCHEMA_VERSION = 1;
const schema = [
  `CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, brand TEXT, variant TEXT, aliases_json TEXT NOT NULL DEFAULT '[]', unit TEXT NOT NULL, selling_price_paise INTEGER, cost_price_paise INTEGER, stock INTEGER NOT NULL DEFAULT 0, reorder_level INTEGER NOT NULL DEFAULT 0, barcode TEXT UNIQUE, expiry_date TEXT, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS bills (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, customer_id TEXT, total_paise INTEGER NOT NULL DEFAULT 0, payment_method TEXT, idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL, confirmed_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS bill_lines (id TEXT PRIMARY KEY NOT NULL, bill_id TEXT NOT NULL REFERENCES bills(id), product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, unit_price_paise INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS inventory_movements (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL REFERENCES products(id), delta INTEGER NOT NULL, reason TEXT NOT NULL, reference_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, phone TEXT, notes TEXT, archived INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS udhaar_entries (id TEXT PRIMARY KEY NOT NULL, customer_id TEXT NOT NULL REFERENCES customers(id), amount_paise INTEGER NOT NULL, kind TEXT NOT NULL, reason TEXT, reference_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL, message TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_status_history (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), status TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_records (id TEXT PRIMARY KEY NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL)`,
];

let database: SQLiteDatabase | undefined;
export function getDatabase(): SQLiteDatabase | undefined {
  if (Platform.OS === 'web') return undefined;
  database ??= openDatabaseSync('kirana-shop.db');
  return database;
}
export function initializeDatabase(): boolean {
  const db = getDatabase();
  if (!db) return false;
  db.withTransactionSync(() => { for (const statement of schema) db.execSync(statement); db.runSync('INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)', 'version', String(SCHEMA_VERSION)); });
  return true;
}
export function recordInventoryMovement(input: { id: string; productId: string; delta: number; reason: string; referenceId?: string; createdAt: string }): boolean {
  const db = getDatabase();
  if (!db) throw new Error('SQLite is unavailable on this platform');
  const result = db.runSync('INSERT OR IGNORE INTO inventory_movements (id, product_id, delta, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', input.id, input.productId, input.delta, input.reason, input.referenceId ?? null, input.createdAt);
  return result.changes === 1;
}
