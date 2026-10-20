import { describe, expect, it } from 'vitest';
import { applySchema } from './sqlite-schema';
import * as DatabaseTypes from './sqlite-schema';
import { BillingRepository, CustomerRepository, DashboardRepository, InventoryRepository, OrderRepository, ProductRepository, UdhaarRepository } from './repositories';
import { createProduct, parseOrderText } from '../../packages/domain/src/index';
type SqliteExecutor = DatabaseTypes.SqliteExecutor;

function testDatabase(): SqliteExecutor {
  const DatabaseSync: any = (process as any).getBuiltinModule('node:sqlite').DatabaseSync;
  const database = new DatabaseSync(':memory:');
  const executor: SqliteExecutor = {
    exec: sql => database.exec(sql),
    run: (sql, ...params) => { const result = database.prepare(sql).run(...params as never[]); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; },
    get: (sql, ...params) => database.prepare(sql).get(...params as never[]) as never,
    all: (sql, ...params) => database.prepare(sql).all(...params as never[]) as never,
    transaction: callback => { database.exec('BEGIN'); try { const result = callback(); database.exec('COMMIT'); return result; } catch (error) { database.exec('ROLLBACK'); throw error; } },
  };
  applySchema(executor);
  return executor;
}

const owner = { id: 'owner', name: 'Owner', active: true, permissions: ['sales.create', 'sales.priceOverride', 'sales.cancel', 'udhaar.adjust', 'products.write', 'inventory.adjust'] as const };
const viewer = { id: 'viewer', name: 'Viewer', active: true, permissions: ['sales.create'] as const };

function seed(executor: SqliteExecutor) {
  const products = new ProductRepository(executor);
  products.save({ id: 'rice', name: 'Rice', aliases: ['biyyam'], unit: 'kg', sellingPrice: 6500n, costPrice: 5000n, stock: 10, reorderLevel: 2, active: true });
  products.save({ id: 'oil', name: 'Oil', aliases: [], unit: 'litre', sellingPrice: 12000n, stock: 3, reorderLevel: 1, active: true });
}

describe('SQLite repositories', () => {
  it('saves a received order without changing stock or revenue', () => {
    const db = testDatabase(); seed(db); const orders = new OrderRepository(db); const product = createProduct({ id: 'rice', name: 'Rice', aliases: ['biyyam'], unit: 'kg', sellingPrice: 6500n, stock: 10, reorderLevel: 2 });
    const saved = orders.create({ source: 'paste', message: '2 kg biyyam', items: parseOrderText('2 kg biyyam', [product]) });
    expect(saved.status).toBe('Received'); expect(db.get<{ stock: number }>('SELECT stock FROM products WHERE id=\'rice\'')?.stock).toBe(10); expect(db.get<{ count: number }>('SELECT count(*) AS count FROM bills')?.count).toBe(0); expect(orders.list()[0].id).toBe(saved.id);
  });
  it('reads live dashboard totals from persisted records', () => {
    const db = testDatabase(); seed(db); const timestamp = new Date().toISOString(); db.run('INSERT INTO bills (id,status,total_paise,payment_method,created_at,confirmed_at) VALUES (?,?,?,?,?,?)', 'b1', 'confirmed', 10000, 'cash', timestamp, timestamp);
    expect(new DashboardRepository(db).today().salesPaise).toBe(10000n);
  });
  it('persists products and drafts without touching stock', () => {
    const db = testDatabase(); seed(db); const products = new ProductRepository(db); const billing = new BillingRepository(db);
    const draft = billing.saveDraft({ lines: [{ productId: 'rice', quantity: 2, unit: 'kg' }] }, owner);
    const reopenedProducts = new ProductRepository(db); const reopenedBilling = new BillingRepository(db);
    expect(draft.status).toBe('draft'); expect(reopenedProducts.get('rice')?.stock).toBe(10); expect(reopenedBilling.get(draft.id)?.lines[0].quantity).toBe(2);
  });
  it('confirms atomically, deducts once, and rejects a repeated confirmation', () => {
    const db = testDatabase(); seed(db); const billing = new BillingRepository(db); const products = new ProductRepository(db);
    const draft = billing.saveDraft({ lines: [{ productId: 'rice', quantity: 2, unit: 'kg' }] }, owner);
    const first = billing.confirm(draft.id, { method: 'cash', amount: 13000n }, 'op-1', owner);
    const second = billing.confirm(draft.id, { method: 'cash', amount: 13000n }, 'op-1', owner);
    expect(first.status).toBe('confirmed'); expect(second.status).toBe('confirmed'); expect(products.get('rice')?.stock).toBe(8); expect(db.all<{ count: number }>('SELECT count(*) AS count FROM inventory_movements')[0]?.count).toBe(1);
  });
  it('rolls back when stock is insufficient', () => {
    const db = testDatabase(); seed(db); const billing = new BillingRepository(db); const products = new ProductRepository(db);
    const draft = billing.saveDraft({ lines: [{ productId: 'oil', quantity: 4, unit: 'litre' }] }, owner);
    expect(() => billing.confirm(draft.id, { method: 'cash', amount: 48000n }, 'op-fail', owner)).toThrow('Insufficient stock');
    expect(products.get('oil')?.stock).toBe(3); expect(db.get<{ count: number }>('SELECT count(*) AS count FROM inventory_movements')?.count).toBe(0); expect(billing.get(draft.id)?.status).toBe('draft');
  });
  it('enforces price override permission and preserves correction history', () => {
    const db = testDatabase(); seed(db); const billing = new BillingRepository(db);
    expect(() => billing.saveDraft({ lines: [{ productId: 'rice', quantity: 1, unit: 'kg', priceOverride: 7000n }] }, viewer)).toThrow('sales.priceOverride');
    const draft = billing.saveDraft({ lines: [{ productId: 'rice', quantity: 1, unit: 'kg', priceOverride: 7000n }] }, owner); billing.confirm(draft.id, { method: 'cash', amount: 7000n }, 'op-correct', owner); billing.recordCorrection(draft.id, owner, 'Wrong price', { correctedTo: '6500' });
    expect(db.get<{ count: number }>('SELECT count(*) AS count FROM bill_corrections WHERE bill_id=?', draft.id)?.count).toBe(1); expect(db.get<{ count: number }>('SELECT count(*) AS count FROM audit_records WHERE entity_id=?', draft.id)?.count).toBe(2);
  });
  it('records idempotent Udhaar payments', () => {
    const db = testDatabase(); const customers = new CustomerRepository(db); customers.save({ id: 'c1', name: 'Lakshmi' }); const udhaar = new UdhaarRepository(db);
    db.run('INSERT INTO udhaar_entries (id,customer_id,amount_paise,kind,created_at) VALUES (?,?,?,?,?)', 'credit-1', 'c1', 100000, 'credit', new Date().toISOString()); udhaar.recordPayment('c1', 30000n, 'upi', 'payment-1', owner); udhaar.recordPayment('c1', 30000n, 'upi', 'payment-1', owner);
    expect(udhaar.balance('c1')).toBe(70000n); expect(db.get<{ count: number }>('SELECT count(*) AS count FROM udhaar_entries WHERE id=?', 'payment-1')?.count).toBe(1);
  });
  it('searches and creates customers, and exposes Udhaar history', () => {
    const db = testDatabase(); const customers = new CustomerRepository(db); const customer = customers.create({ name: 'Anita Sharma', phone: '98765' });
    expect(customers.search('987')).toHaveLength(1);
    db.run('INSERT INTO udhaar_entries (id,customer_id,amount_paise,kind,created_at) VALUES (?,?,?,?,?)', 'credit-2', customer.id, 50000, 'credit', new Date().toISOString());
    const udhaar = new UdhaarRepository(db); expect(udhaar.balances()[0]?.balance).toBe(50000n); expect(udhaar.history(customer.id)[0]?.kind).toBe('credit');
  });
  it('rejects invalid corrections and returns correction history', () => {
    const db = testDatabase(); seed(db); const billing = new BillingRepository(db); const draft = billing.saveDraft({ lines: [{ productId: 'rice', quantity: 1, unit: 'kg' }] }, owner); billing.confirm(draft.id, { method: 'cash', amount: 6500n }, 'op-history', owner);
    expect(() => billing.recordCorrection(draft.id, owner, '')).toThrow('reason'); billing.recordCorrection(draft.id, owner, 'Customer requested correction'); expect(billing.corrections(draft.id)).toHaveLength(1);
  });
  it('creates, updates, archives products and persists inventory movements', () => {
    const db = testDatabase(); const products = new ProductRepository(db); const inventory = new InventoryRepository(db);
    const product = products.create({ name: 'Salt', aliases: ['uppu'], unit: 'kg', sellingPrice: 3000n, costPrice: 2200n, reorderLevel: 4 }, owner);
    expect(products.get(product.id)?.stock).toBe(0);
    products.update(product.id, { ...product, name: 'Iodized Salt' }, owner);
    inventory.restock(product.id, 5, 'restock-1', owner); inventory.restock(product.id, 5, 'restock-1', owner);
    expect(products.get(product.id)?.name).toBe('Iodized Salt'); expect(products.get(product.id)?.stock).toBe(5);
    products.archive(product.id, owner); expect(products.search()).toHaveLength(0);
  });
  it('supports adjustments, low-stock queries, and rejects negative stock', () => {
    const db = testDatabase(); seed(db); const inventory = new InventoryRepository(db); const products = new ProductRepository(db);
    inventory.adjust('rice', -9, 'damaged', 'adjust-1', owner);
    expect(products.lowStock().map(product => product.id)).toContain('rice');
    expect(() => inventory.adjust('rice', -2, 'damaged', 'adjust-2', owner)).toThrow('Insufficient stock');
    expect(inventory.movements('rice')).toHaveLength(1);
  });
});
