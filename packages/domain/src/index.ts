export type Paise = bigint;

export function paise(value: number | string | bigint): Paise {
  if (typeof value === 'bigint') return value;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Amount must be non-negative rupees with at most 2 decimals');
  const [rupees, fraction = ''] = text.split('.');
  return BigInt(rupees) * 100n + BigInt((fraction + '00').slice(0, 2));
}

export const addMoney = (...values: Paise[]) => values.reduce((sum, value) => sum + value, 0n);
export function multiplyMoney(price: Paise, quantity: number): Paise {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantity must be a non-negative integer');
  return price * BigInt(quantity);
}
export function formatRupees(value: Paise): string {
  if (value < 0n) return `-${formatRupees(-value)}`;
  return `₹${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

export type Unit = 'piece' | 'packet' | 'box' | 'carton' | 'kg' | 'g' | 'litre' | 'ml';
export type Product = {
  id: string; sku?: string; name: string; brand?: string; variant?: string;
  aliases: string[]; unit: Unit; sellingPrice?: Paise; costPrice?: Paise;
  stock: number; reorderLevel: number; barcode?: string; expiryDate?: string; active: boolean;
};
export function createProduct(input: Omit<Product, 'active' | 'aliases' | 'reorderLevel'> & Partial<Pick<Product, 'active' | 'aliases' | 'reorderLevel'>>): Product {
  if (!input.id || !input.name || input.stock < 0 || (input.sellingPrice !== undefined && input.sellingPrice < 0n)) throw new Error('Invalid product');
  return { ...input, aliases: input.aliases ?? [], reorderLevel: input.reorderLevel ?? 0, active: input.active ?? true };
}
export const changeProductPrice = (product: Product, price: Paise) => price < 0n ? (() => { throw new Error('Price cannot be negative'); })() : { ...product, sellingPrice: price };

export type DraftLine = { productId: string; name: string; quantity: number; unitPrice?: Paise; unit: Unit; uncertain?: boolean; priceOverride?: Paise };
export type BillingDraft = { id: string; lines: DraftLine[]; customerId?: string; notes?: string; source?: 'manual' | 'paste' | 'voice' };
export type Payment = { method: 'cash' | 'upi' | 'card' | 'credit'; amount: Paise };
export type Sale = BillingDraft & { status: 'confirmed'; subtotal: Paise; total: Paise; payment: Payment; confirmedAt: string; idempotencyKey: string };
export function draftTotal(draft: BillingDraft): Paise {
  return draft.lines.reduce((sum, line) => sum + multiplyMoney(line.priceOverride ?? line.unitPrice ?? 0n, line.quantity), 0n);
}
export function confirmSale(draft: BillingDraft, payment: Payment, key: string, now = new Date().toISOString()): Sale {
  if (!key || !draft.lines.length || draft.lines.some(line => !line.unitPrice && !line.priceOverride)) throw new Error('Sale requires priced lines and idempotency key');
  const subtotal = draftTotal(draft);
  if (payment.amount !== subtotal) throw new Error('Payment must equal sale total');
  return { ...draft, status: 'confirmed', subtotal, total: subtotal, payment, confirmedAt: now, idempotencyKey: key };
}

export type InventoryReason = 'opening' | 'purchase' | 'sale' | 'customer-return' | 'supplier-return' | 'adjustment' | 'damage' | 'expiry' | 'correction';
export type InventoryEntry = { id: string; productId: string; delta: number; reason: InventoryReason; referenceId?: string; createdAt: string };
export class InventoryLedger {
  private readonly entries = new Map<string, InventoryEntry>();
  append(entry: InventoryEntry): boolean { if (this.entries.has(entry.id)) return false; if (!Number.isInteger(entry.delta)) throw new Error('Inventory delta must be integer'); this.entries.set(entry.id, entry); return true; }
  balance(productId: string, opening = 0): number { return opening + [...this.entries.values()].filter(entry => entry.productId === productId).reduce((sum, entry) => sum + entry.delta, 0); }
  all(): InventoryEntry[] { return [...this.entries.values()]; }
}

export type UdhaarEntry = { id: string; customerId: string; amount: Paise; kind: 'credit' | 'payment' | 'adjustment'; referenceId?: string; reason?: string; createdAt: string };
export class UdhaarLedger {
  private readonly entries = new Map<string, UdhaarEntry>();
  append(entry: UdhaarEntry): boolean { if (entry.amount <= 0n) throw new Error('Amount must be positive'); if (this.entries.has(entry.id)) return false; this.entries.set(entry.id, entry); return true; }
  balance(customerId: string): Paise { return [...this.entries.values()].filter(entry => entry.customerId === customerId).reduce((sum, entry) => sum + (entry.kind === 'credit' ? entry.amount : -entry.amount), 0n); }
  all(): UdhaarEntry[] { return [...this.entries.values()]; }
}

export type OrderStatus = 'Received' | 'Confirmed' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';
const orderTransitions: Record<OrderStatus, OrderStatus[]> = { Received: ['Confirmed', 'Cancelled'], Confirmed: ['Preparing', 'Cancelled'], Preparing: ['Ready', 'Cancelled'], Ready: ['Completed', 'Cancelled'], Completed: [], Cancelled: [] };
export function transitionOrder(status: OrderStatus, next: OrderStatus): OrderStatus { if (!orderTransitions[status].includes(next)) throw new Error(`Invalid order transition ${status} -> ${next}`); return next; }
export type OrderStatusEvent = { status: OrderStatus; at: string; actorId: string };

export function suggestPrice(cost: Paise, marginPercent: number, roundTo: Paise = 100n): Paise {
  if (cost < 0n || marginPercent < 0 || roundTo <= 0n) throw new Error('Invalid pricing input');
  const raw = cost * BigInt(Math.round((100 + marginPercent) * 100)) / 10000n;
  return ((raw + roundTo - 1n) / roundTo) * roundTo;
}

export function normalizeSearch(text: string): string { return text.normalize('NFKC').toLocaleLowerCase('en-IN').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
export function matchProducts(query: string, products: Product[]): Product[] {
  const needle = normalizeSearch(query);
  return products.filter(product => product.active && [product.name, product.brand, product.variant, product.sku, product.barcode, ...product.aliases].filter(Boolean).some(value => normalizeSearch(value!).includes(needle)));
}
export type ParsedItem = { text: string; quantity: number; unit?: Unit; candidates: Product[]; uncertain: boolean };
const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, एक: 1, दो: 2, तीन: 3, ఒకటి: 1, రెండు: 2, మూడు: 3 };
export function parseOrderText(text: string, products: Product[]): ParsedItem[] {
  return text.split(/,|\band\b|\n/iu).map(part => part.trim()).filter(Boolean).map(part => {
    const quantityMatch = part.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|एक|दो|तीन|ఒకటి|రెండు|మూడు)\b/iu);
    const quantity = quantityMatch ? Number(numberWords[quantityMatch[1].toLocaleLowerCase()] ?? quantityMatch[1]) : 1;
    const unitMatch = part.match(/\b(kg|kilo(?:s)?|g|gram(?:s)?|litre|liter|l|ml|packet(?:s)?|pack(?:s)?|piece(?:s)?|box(?:es)?|carton(?:s)?)\b/iu);
    const unit: Unit | undefined = unitMatch ? ({ kilos: 'kg', kilo: 'kg', kg: 'kg', grams: 'g', gram: 'g', litres: 'litre', liter: 'litre', l: 'litre', packets: 'packet', packs: 'packet', pieces: 'piece', boxes: 'box', cartons: 'carton' } as Record<string, Unit>)[unitMatch[1].toLocaleLowerCase()] ?? unitMatch[1].toLocaleLowerCase() as Unit : undefined;
    const productText = part.replace(quantityMatch?.[0] ?? '', '').replace(unitMatch?.[0] ?? '', '').trim();
    const candidates = matchProducts(productText, products);
    return { text: productText, quantity, unit, candidates, uncertain: candidates.length !== 1 || !candidates[0].sellingPrice };
  });
}

export type Permission = 'products.read' | 'products.write' | 'sales.create' | 'sales.cancel' | 'inventory.adjust' | 'udhaar.adjust' | 'reports.read' | 'settings.manage' | 'staff.manage';
export type Staff = { id: string; name: string; permissions: readonly Permission[]; active: boolean };
export type AuditRecord = { id: string; actorId: string; action: string; entity: string; entityId: string; metadata?: Record<string, string>; at: string };
export const can = (staff: Staff, permission: Permission) => staff.active && staff.permissions.includes(permission);
export function audit(staff: Staff, permission: Permission, record: Omit<AuditRecord, 'actorId'>): AuditRecord { if (!can(staff, permission)) throw new Error('Forbidden'); return { ...record, actorId: staff.id }; }

export interface ProviderAdapter { readonly id: string; testConnection(): Promise<{ ok: true; model?: string }>; parseOrder(input: { text: string; language?: string }): Promise<unknown>; }
export interface MessagingProvider { send(message: { to: string; body: string }): Promise<{ messageId: string; status: 'queued' | 'sent' | 'failed' }> }
export class HttpJsonClient {
  constructor(private readonly baseUrl: string, private readonly token?: string) { const url = new URL(baseUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Provider URL must be HTTP(S)'); }
  async post<T>(path: string, body: unknown): Promise<T> { const response = await fetch(new URL(path, this.baseUrl), { method: 'POST', headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(`Provider request failed (${response.status})`); return await response.json() as T; }
}
