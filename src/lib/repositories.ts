import { can } from '../../packages/domain/src/index';
import * as DomainTypes from '../../packages/domain/src/index';
import * as DatabaseTypes from './sqlite-schema';
type BillingDraft = DomainTypes.BillingDraft;
type Product = DomainTypes.Product;
type Staff = DomainTypes.Staff;
type Unit = DomainTypes.Unit;
type SqliteExecutor = DatabaseTypes.SqliteExecutor;

type ProductRow = { id: string; sku?: string; name: string; brand?: string; variant?: string; aliases_json: string; unit: Unit; selling_price_paise: number | null; cost_price_paise: number | null; stock: number; reorder_level: number; barcode?: string | null; expiry_date?: string | null; active: number };
type BillRow = { id: string; status: 'draft' | 'confirmed' | 'corrected' | 'cancelled'; customer_id?: string | null; notes?: string | null; source: BillingDraft['source']; total_paise: number; payment_method?: 'cash' | 'upi' | 'card' | 'credit' | null; idempotency_key?: string | null; created_at: string; confirmed_at?: string | null };
type BillLineRow = { id: string; bill_id: string; product_id: string; name: string; quantity: number; unit: Unit; unit_price_paise: number; price_overridden: number };
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const paiseToSql = (value: bigint) => Number(value);
const sqlToPaise = (value: number | null | undefined) => BigInt(value ?? 0);

function mapProduct(row: ProductRow): Product { return { id: row.id, sku: row.sku ?? undefined, name: row.name, brand: row.brand ?? undefined, variant: row.variant ?? undefined, aliases: JSON.parse(row.aliases_json || '[]') as string[], unit: row.unit, sellingPrice: row.selling_price_paise === null ? undefined : sqlToPaise(row.selling_price_paise), costPrice: row.cost_price_paise === null ? undefined : sqlToPaise(row.cost_price_paise), stock: row.stock, reorderLevel: row.reorder_level, barcode: row.barcode ?? undefined, expiryDate: row.expiry_date ?? undefined, active: row.active === 1 }; }

export class ProductRepository {
  constructor(private readonly db: SqliteExecutor) {}
  save(product: Product): void { this.db.run('INSERT INTO products (id, sku, name, brand, variant, aliases_json, unit, selling_price_paise, cost_price_paise, stock, reorder_level, barcode, expiry_date, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku, name=excluded.name, brand=excluded.brand, variant=excluded.variant, aliases_json=excluded.aliases_json, unit=excluded.unit, selling_price_paise=excluded.selling_price_paise, cost_price_paise=excluded.cost_price_paise, stock=excluded.stock, reorder_level=excluded.reorder_level, barcode=excluded.barcode, expiry_date=excluded.expiry_date, active=excluded.active', product.id, product.sku ?? null, product.name, product.brand ?? null, product.variant ?? null, JSON.stringify(product.aliases), product.unit, product.sellingPrice === undefined ? null : paiseToSql(product.sellingPrice), product.costPrice === undefined ? null : paiseToSql(product.costPrice), product.stock, product.reorderLevel, product.barcode ?? null, product.expiryDate ?? null, product.active ? 1 : 0); }
  search(query = ''): Product[] { const text = `%${query.trim().toLocaleLowerCase()}%`; return this.db.all<ProductRow>('SELECT * FROM products WHERE active = 1 AND (lower(name) LIKE ? OR lower(brand) LIKE ? OR lower(aliases_json) LIKE ? OR barcode = ?) ORDER BY name LIMIT 50', text, text, text, query.trim()).map(mapProduct); }
  get(productId: string): Product | null { const row = this.db.get<ProductRow>('SELECT * FROM products WHERE id = ?', productId); return row ? mapProduct(row) : null; }
}

export type DraftInput = { id?: string; lines: Array<{ productId: string; quantity: number; unitPrice?: bigint; priceOverride?: bigint; unit: Unit }>; customerId?: string; notes?: string; source?: BillingDraft['source'] };
export type StoredBill = BillingDraft & { status: BillRow['status']; total: bigint; paymentMethod?: BillRow['payment_method']; createdAt: string; confirmedAt?: string };

export class BillingRepository {
  constructor(private readonly db: SqliteExecutor) {}
  private read(idValue: string): StoredBill | null { const bill = this.db.get<BillRow>('SELECT * FROM bills WHERE id = ?', idValue); if (!bill) return null; const lines = this.db.all<BillLineRow>('SELECT bl.*, p.name, p.unit FROM bill_lines bl JOIN products p ON p.id = bl.product_id WHERE bl.bill_id = ? ORDER BY bl.rowid', idValue).map(line => ({ productId: line.product_id, name: line.name, quantity: line.quantity, unit: line.unit, unitPrice: sqlToPaise(line.unit_price_paise), priceOverride: line.price_overridden ? sqlToPaise(line.unit_price_paise) : undefined })); return { id: bill.id, lines, customerId: bill.customer_id ?? undefined, notes: bill.notes ?? undefined, source: bill.source, status: bill.status, total: sqlToPaise(bill.total_paise), paymentMethod: bill.payment_method ?? undefined, createdAt: bill.created_at, confirmedAt: bill.confirmed_at ?? undefined }; }
  get(idValue: string): StoredBill | null { return this.read(idValue); }
  listRecent(limit = 50): StoredBill[] { return this.db.all<BillRow>('SELECT * FROM bills ORDER BY created_at DESC LIMIT ?', limit).map(row => this.read(row.id)!).filter(Boolean); }
  saveDraft(input: DraftInput, actor: Staff): StoredBill {
    if (!can(actor, 'sales.create')) throw new Error('Forbidden: sales.create');
    if (!input.lines.length || input.lines.some(line => !Number.isInteger(line.quantity) || line.quantity <= 0)) throw new Error('A draft needs positive integer quantities');
    if (input.lines.some(line => line.priceOverride !== undefined) && !can(actor, 'sales.priceOverride')) throw new Error('Forbidden: sales.priceOverride');
    const billId = input.id ?? id('bill');
    this.db.transaction(() => {
      const existing = this.db.get<{ status: BillRow['status'] }>('SELECT status FROM bills WHERE id = ?', billId);
      if (existing && existing.status !== 'draft') throw new Error('Only draft bills can be edited');
      this.db.run('INSERT INTO bills (id, status, customer_id, notes, source, total_paise, created_at) VALUES (?, \'draft\', ?, ?, ?, 0, ?) ON CONFLICT(id) DO UPDATE SET customer_id=excluded.customer_id, notes=excluded.notes, source=excluded.source', billId, input.customerId ?? null, input.notes ?? null, input.source ?? 'manual', now());
      this.db.run('DELETE FROM bill_lines WHERE bill_id = ?', billId);
      for (const line of input.lines) { const product = new ProductRepository(this.db).get(line.productId); if (!product) throw new Error(`Unknown product: ${line.productId}`); const price = line.priceOverride ?? line.unitPrice ?? product.sellingPrice; if (price === undefined) throw new Error(`Product has no selling price: ${product.name}`); this.db.run('INSERT INTO bill_lines (id, bill_id, product_id, quantity, unit_price_paise, price_overridden) VALUES (?, ?, ?, ?, ?, ?)', id('line'), billId, product.id, line.quantity, paiseToSql(price), line.priceOverride === undefined ? 0 : 1); }
      this.db.run('UPDATE bills SET total_paise = ? WHERE id = ?', paiseToSql(this.totalForLines(billId)), billId);
    });
    return this.read(billId)!;
  }
  private totalForLines(billId: string): bigint { return this.db.all<{ unit_price_paise: number; quantity: number }>('SELECT unit_price_paise, quantity FROM bill_lines WHERE bill_id = ?', billId).reduce((sum, line) => sum + BigInt(line.unit_price_paise) * BigInt(line.quantity), 0n); }
  confirm(billId: string, payment: { method: 'cash' | 'upi' | 'card' | 'credit'; amount: bigint }, idempotencyKey: string, actor: Staff): StoredBill {
    if (!can(actor, 'sales.create')) throw new Error('Forbidden: sales.create');
    if (!idempotencyKey) throw new Error('Idempotency key is required');
    let result: StoredBill | null = null;
    this.db.transaction(() => {
      const bill = this.db.get<BillRow>('SELECT * FROM bills WHERE id = ?', billId); if (!bill) throw new Error('Bill not found');
      if (bill.status === 'confirmed') { result = this.read(billId); return; }
      if (bill.status !== 'draft') throw new Error('Only draft bills can be confirmed');
      const duplicate = this.db.get<{ id: string }>('SELECT id FROM bills WHERE idempotency_key = ?', idempotencyKey); if (duplicate && duplicate.id !== billId) throw new Error('Idempotency key already used');
      const lines = this.db.all<BillLineRow>('SELECT bl.*, p.name, p.unit, p.stock FROM bill_lines bl JOIN products p ON p.id = bl.product_id WHERE bl.bill_id = ?', billId) as (BillLineRow & { stock: number })[];
      if (!lines.length) throw new Error('Bill has no lines');
      const total = this.totalForLines(billId); if (payment.amount !== total) throw new Error('Payment must equal bill total'); if (payment.method === 'credit' && !bill.customer_id) throw new Error('Credit sales require a customer');
      for (const line of lines) { if (line.stock < line.quantity) throw new Error(`Insufficient stock for ${line.name}`); }
      const confirmedAt = now(); this.db.run('UPDATE bills SET status=\'confirmed\', total_paise=?, payment_method=?, idempotency_key=?, confirmed_at=? WHERE id=? AND status=\'draft\'', paiseToSql(total), payment.method, idempotencyKey, confirmedAt, billId);
      for (const line of lines) { const movementId = `${billId}:sale:${line.id}`; this.db.run('INSERT INTO inventory_movements (id, product_id, delta, reason, reference_id, created_at) VALUES (?, ?, ?, \'sale\', ?, ?)', movementId, line.product_id, -line.quantity, billId, confirmedAt); const updated = this.db.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', line.quantity, line.product_id, line.quantity); if (updated.changes !== 1) throw new Error(`Stock changed while confirming ${line.name}`); }
      if (payment.method === 'credit') this.db.run('INSERT INTO udhaar_entries (id, customer_id, amount_paise, kind, reference_id, created_at) VALUES (?, ?, ?, \'credit\', ?, ?)', `${billId}:credit`, bill.customer_id, paiseToSql(total), billId, confirmedAt);
      this.db.run('INSERT INTO audit_records (id, actor_id, action, entity, entity_id, metadata_json, created_at) VALUES (?, ?, \'sale.confirmed\', \'bill\', ?, ?, ?)', id('audit'), actor.id, billId, JSON.stringify({ totalPaise: total.toString(), payment: payment.method }), confirmedAt);
      result = this.read(billId);
    });
    return result!;
  }
  recordCorrection(billId: string, actor: Staff, reason: string, metadata: Record<string, string> = {}): void { if (!can(actor, 'sales.cancel')) throw new Error('Forbidden: sales.cancel'); const bill = this.db.get<BillRow>('SELECT status FROM bills WHERE id=?', billId); if (!bill || bill.status !== 'confirmed') throw new Error('Only confirmed bills can be corrected'); this.db.run('CREATE TABLE IF NOT EXISTS bill_corrections (id TEXT PRIMARY KEY NOT NULL, bill_id TEXT NOT NULL REFERENCES bills(id), actor_id TEXT NOT NULL, reason TEXT NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL)'); this.db.run('INSERT INTO bill_corrections (id, bill_id, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', id('correction'), billId, actor.id, reason, JSON.stringify(metadata), now()); this.db.run('INSERT INTO audit_records (id, actor_id, action, entity, entity_id, metadata_json, created_at) VALUES (?, ?, \'bill.corrected\', \'bill\', ?, ?, ?)', id('audit'), actor.id, billId, JSON.stringify({ reason, ...metadata }), now()); }
}

export class CustomerRepository { constructor(private readonly db: SqliteExecutor) {} save(customer: { id: string; name: string; phone?: string; notes?: string }): void { this.db.run('INSERT INTO customers (id,name,phone,notes) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, notes=excluded.notes', customer.id, customer.name, customer.phone ?? null, customer.notes ?? null); } list(): Array<{ id: string; name: string; phone?: string; notes?: string }> { return this.db.all<{ id: string; name: string; phone?: string; notes?: string }>('SELECT id,name,phone,notes FROM customers WHERE archived=0 ORDER BY name'); } }
export class UdhaarRepository { constructor(private readonly db: SqliteExecutor) {} balance(customerId: string): bigint { return this.db.all<{ amount_paise: number; kind: string }>('SELECT amount_paise,kind FROM udhaar_entries WHERE customer_id=?', customerId).reduce((sum, row) => sum + (row.kind === 'credit' ? BigInt(row.amount_paise) : -BigInt(row.amount_paise)), 0n); } recordPayment(customerId: string, amount: bigint, method: string, idempotencyKey: string, actor: Staff): void { if (!can(actor, 'udhaar.adjust')) throw new Error('Forbidden: udhaar.adjust'); if (amount <= 0n) throw new Error('Payment must be positive'); this.db.run('INSERT OR IGNORE INTO udhaar_entries (id,customer_id,amount_paise,kind,reason,reference_id,created_at) VALUES (?,?,?,?,?,?,?)', idempotencyKey, customerId, paiseToSql(amount), 'payment', method, idempotencyKey, now()); } }
export class AuditRepository { constructor(private readonly db: SqliteExecutor) {} list(entity: string, entityId: string): Array<{ action: string; actor_id: string; metadata_json?: string; created_at: string }> { return this.db.all('SELECT action,actor_id,metadata_json,created_at FROM audit_records WHERE entity=? AND entity_id=? ORDER BY created_at', entity, entityId); } }
