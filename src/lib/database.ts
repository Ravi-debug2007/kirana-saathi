import { Platform } from 'react-native';
import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { applySchema, type SqliteExecutor } from './sqlite-schema';
export { applySchema, SCHEMA_VERSION, schema } from './sqlite-schema';
export type { SqliteExecutor, SqliteStatementResult } from './sqlite-schema';

let database: SQLiteDatabase | undefined;
export function getDatabase(): SQLiteDatabase | undefined { if (Platform.OS === 'web') return undefined; database ??= openDatabaseSync('kirana-shop.db'); return database; }
export function initializeDatabase(): boolean { const db = getDatabase(); if (!db) return false; applySchema(createExpoExecutor(db)); return true; }
export function createExpoExecutor(db: SQLiteDatabase): SqliteExecutor { return { exec: sql => db.execSync(sql), run: (sql, ...params) => { const result = db.runSync(sql, ...params as never[]); return { changes: result.changes, lastInsertRowId: Number(result.lastInsertRowId) }; }, get: (sql, ...params) => db.getFirstSync(sql, ...params as never[]) as never, all: (sql, ...params) => db.getAllSync(sql, ...params as never[]) as never, transaction: <T>(callback: () => T) => db.withTransactionSync(callback) as T }; }
export function recordInventoryMovement(input: { id: string; productId: string; delta: number; reason: string; referenceId?: string; createdAt: string }): boolean { const db = getDatabase(); if (!db) throw new Error('SQLite is unavailable on this platform'); const result = db.runSync('INSERT OR IGNORE INTO inventory_movements (id, product_id, delta, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', input.id, input.productId, input.delta, input.reason, input.referenceId ?? null, input.createdAt); return result.changes === 1; }
