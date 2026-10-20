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
  create(input: Omit<Product, 'id' | 'active' | 'stock'>, actor: Staff): Product {
    if (!can(actor, 'products.write')) throw new Error('Forbidden: products.write');
    const product = { ...input, id: id('product'), stock: 0, active: true };
    validateProduct(product); this.save(product); return this.get(product.id)!;
  }
  update(productId: string, input: Omit<Product, 'id' | 'active' | 'stock'>, actor: Staff): Product {
    if (!can(actor, 'products.write')) throw new Error('Forbidden: products.write');
    this.db.transaction(() => {
      const existing = this.get(productId);
      if (!existing?.active) throw new Error('Active product not found');
      const product = { ...input, id: existing.id, stock: existing.stock, active: existing.active };
      validateProduct(product); this.save(product);
    });
    return this.get(productId)!;
  }
  archive(productId: string, actor: Staff): void {
    if (!can(actor, 'products.write')) throw new Error('Forbidden: products.write');
    if (this.db.run('UPDATE products SET active=0 WHERE id=?', productId).changes !== 1) throw new Error('Product not found');
  }
  list(): Product[] { return this.db.all<ProductRow>('SELECT * FROM products WHERE active=1 ORDER BY name').map(mapProduct); }
  lowStock(): Product[] { return this.db.all<ProductRow>('SELECT * FROM products WHERE active=1 AND stock <= reorder_level ORDER BY name').map(mapProduct); }
  save(product: Product): void { this.db.run('INSERT INTO products (id, sku, name, brand, variant, aliases_json, unit, selling_price_paise, cost_price_paise, stock, reorder_level, barcode, expiry_date, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku, name=excluded.name, brand=excluded.brand, variant=excluded.variant, aliases_json=excluded.aliases_json, unit=excluded.unit, selling_price_paise=excluded.selling_price_paise, cost_price_paise=excluded.cost_price_paise, stock=excluded.stock, reorder_level=excluded.reorder_level, barcode=excluded.barcode, expiry_date=excluded.expiry_date, active=excluded.active', product.id, product.sku ?? null, product.name, product.brand ?? null, product.variant ?? null, JSON.stringify(product.aliases), product.unit, product.sellingPrice === undefined ? null : paiseToSql(product.sellingPrice), product.costPrice === undefined ? null : paiseToSql(product.costPrice), product.stock, product.reorderLevel, product.barcode ?? null, product.expiryDate ?? null, product.active ? 1 : 0); }
  search(query = ''): Product[] { const text = `%${query.trim().toLocaleLowerCase()}%`; return this.db.all<ProductRow>('SELECT * FROM products WHERE active = 1 AND (lower(name) LIKE ? OR lower(brand) LIKE ? OR lower(aliases_json) LIKE ? OR barcode = ?) ORDER BY name LIMIT 50', text, text, text, query.trim()).map(mapProduct); }
  get(productId: string): Product | null { const row = this.db.get<ProductRow>('SELECT * FROM products WHERE id = ?', productId); return row ? mapProduct(row) : null; }
}

function validateProduct(product: Product): void {
  if (!product.name.trim()) throw new Error('Product name is required');
  if (!['piece', 'packet', 'box', 'carton', 'kg', 'g', 'litre', 'ml'].includes(product.unit)) throw new Error('Invalid unit');
  if (!Number.isSafeInteger(product.reorderLevel) || product.reorderLevel < 0) throw new Error('Reorder level must be a non-negative whole number');
  for (const price of [product.sellingPrice, product.costPrice]) if (price !== undefined && (price < 0n || price > BigInt(Number.MAX_SAFE_INTEGER))) throw new Error('Price is outside the supported range');
}

export type InventoryMovement = { id: string; product_id: string; delta: number; reason: string; reference_id: string | null; created_at: string };
export class InventoryRepository {
  constructor(private readonly db: SqliteExecutor) {}
  movements(productId: string): InventoryMovement[] { return this.db.all<InventoryMovement>('SELECT * FROM inventory_movements WHERE product_id=? ORDER BY created_at DESC, rowid DESC', productId); }
  restock(productId: string, quantity: number, key: string, actor: Staff): void {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Restock quantity must be a positive whole number');
    this.move(productId, quantity, 'restock', key, actor);
  }
  adjust(productId: string, delta: number, reason: string, key: string, actor: Staff): void {
    if (!reason.trim()) throw new Error('Adjustment reason is required');
    this.move(productId, delta, `adjustment: ${reason.trim()}`, key, actor);
  }
  private move(productId: string, delta: number, reason: string, key: string, actor: Staff): void {
    if (!can(actor, 'inventory.adjust')) throw new Error('Forbidden: inventory.adjust');
    if (!key.trim()) throw new Error('Movement key is required');
    if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('Quantity must be a non-zero whole number');
    this.db.transaction(() => {
      const existing = this.db.get<InventoryMovement>('SELECT * FROM inventory_movements WHERE id=?', key);
      if (existing) {
        if (existing.product_id !== productId || existing.delta !== delta || existing.reason !== reason) throw new Error('Movement key already used for a different operation');
        return;
      }
      const product = new ProductRepository(this.db).get(productId);
      if (!product?.active) throw new Error('Active product not found');
      const stock = product.stock + delta;
      if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Insufficient stock or quantity outside supported range');
      this.db.run('INSERT INTO inventory_movements (id,product_id,delta,reason,created_at) VALUES (?,?,?,?,?)', key, productId, delta, reason, now());
      this.db.run('UPDATE products SET stock=? WHERE id=?', stock, productId);
    });
  }
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
  corrections(billId: string): Array<{ id: string; actor_id: string; reason: string; metadata_json: string; created_at: string }> { return this.db.all('SELECT id,actor_id,reason,metadata_json,created_at FROM bill_corrections WHERE bill_id=? ORDER BY created_at DESC, rowid DESC', billId); }
  recordCorrection(billId: string, actor: Staff, reason: string, metadata: Record<string, string> = {}): void {
    if (!can(actor, 'sales.cancel')) throw new Error('Forbidden: sales.cancel');
    if (!reason.trim()) throw new Error('A correction reason is required');
    this.db.transaction(() => {
      const bill = this.db.get<BillRow>('SELECT status FROM bills WHERE id=?', billId);
      if (!bill || bill.status !== 'confirmed') throw new Error('Only confirmed bills can be corrected');
      const timestamp = now();
      this.db.run('INSERT INTO bill_corrections (id, bill_id, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', id('correction'), billId, actor.id, reason.trim(), JSON.stringify(metadata), timestamp);
      this.db.run('INSERT INTO audit_records (id, actor_id, action, entity, entity_id, metadata_json, created_at) VALUES (?, ?, \'bill.corrected\', \'bill\', ?, ?, ?)', id('audit'), actor.id, billId, JSON.stringify({ ...metadata, reason: reason.trim() }), timestamp);
    });
  }
}

export type Customer = { id: string; name: string; phone?: string | null; notes?: string | null };
export class CustomerRepository {
  constructor(private readonly db: SqliteExecutor) {}
  save(customer: Customer): void { if (!customer.name.trim()) throw new Error('Customer name is required'); this.db.run('INSERT INTO customers (id,name,phone,notes) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, notes=excluded.notes', customer.id, customer.name.trim(), customer.phone?.trim() || null, customer.notes?.trim() || null); }
  create(input: Omit<Customer, 'id'>): Customer { const customer = { ...input, id: id('customer') }; this.save(customer); return this.get(customer.id)!; }
  get(customerId: string): Customer | null { return this.db.get('SELECT id,name,phone,notes FROM customers WHERE id=?', customerId); }
  search(query = ''): Customer[] { const text = `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`; return this.db.all("SELECT id,name,phone,notes FROM customers WHERE archived=0 AND (name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\') ORDER BY name, id", text, text); }
  list(): Customer[] { return this.search(); }
}
export type UdhaarEntry = { id: string; amount: bigint; kind: string; reason: string | null; referenceId: string | null; createdAt: string };
export class UdhaarRepository {
  constructor(private readonly db: SqliteExecutor) {}
  history(customerId: string): UdhaarEntry[] { return this.db.all<{ id: string; amount_paise: number; kind: string; reason: string | null; reference_id: string | null; created_at: string }>('SELECT * FROM udhaar_entries WHERE customer_id=? ORDER BY created_at DESC, rowid DESC', customerId).map(row => ({ id: row.id, amount: BigInt(row.amount_paise), kind: row.kind, reason: row.reason, referenceId: row.reference_id, createdAt: row.created_at })); }
  balance(customerId: string): bigint { return this.history(customerId).reduce((sum, row) => sum + (row.kind === 'credit' ? row.amount : -row.amount), 0n); }
  balances(query = ''): Array<Customer & { balance: bigint }> { return new CustomerRepository(this.db).search(query).map(customer => ({ ...customer, balance: this.balance(customer.id) })); }
  recordPayment(customerId: string, amount: bigint, method: string, idempotencyKey: string, actor: Staff): void {
    if (!can(actor, 'udhaar.adjust')) throw new Error('Forbidden: udhaar.adjust');
    if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Payment must be positive and within the supported range');
    if (!['cash', 'upi', 'card'].includes(method)) throw new Error('Choose cash, upi or card');
    if (!idempotencyKey.trim()) throw new Error('Idempotency key is required');
    this.db.transaction(() => {
      const previous = this.db.get<{ customer_id: string; amount_paise: number; kind: string; reason: string }>('SELECT * FROM udhaar_entries WHERE id=?', idempotencyKey);
      if (previous) { if (previous.customer_id !== customerId || BigInt(previous.amount_paise) !== amount || previous.kind !== 'payment' || previous.reason !== method) throw new Error('Idempotency key already used'); return; }
      if (!new CustomerRepository(this.db).get(customerId)) throw new Error('Customer not found');
      if (amount > this.balance(customerId)) throw new Error('Payment exceeds outstanding balance');
      this.db.run('INSERT INTO udhaar_entries (id,customer_id,amount_paise,kind,reason,reference_id,created_at) VALUES (?,?,?,?,?,?,?)', idempotencyKey, customerId, paiseToSql(amount), 'payment', method, idempotencyKey, now());
    });
  }
}
export class AuditRepository { constructor(private readonly db: SqliteExecutor) {} list(entity: string, entityId: string): Array<{ action: string; actor_id: string; metadata_json?: string; created_at: string }> { return this.db.all('SELECT action,actor_id,metadata_json,created_at FROM audit_records WHERE entity=? AND entity_id=? ORDER BY created_at', entity, entityId); } }
