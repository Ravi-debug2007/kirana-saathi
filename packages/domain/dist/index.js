export function paise(v) { if (typeof v === 'bigint')
    return v; const s = String(v).trim(); if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error('Amount must be non-negative rupees with at most 2 decimals'); const [r, f = ''] = s.split('.'); return BigInt(r) * 100n + BigInt((f + '00').slice(0, 2)); }
export const addMoney = (...v) => v.reduce((a, b) => a + b, 0n);
export const multiplyMoney = (a, q) => { if (!Number.isInteger(q) || q < 0)
    throw new Error('Quantity must be a non-negative integer'); return a * BigInt(q); };
export const formatRupees = (a) => a < 0n ? `-${formatRupees(-a)}` : `₹${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
export function createProduct(i) { if (!i.id || !i.name || i.sellingPrice < 0n || i.stock < 0)
    throw new Error('Invalid product'); return { ...i, active: i.active ?? true }; }
;
export const changeProductPrice = (p, price) => { if (price < 0n)
    throw new Error('Price cannot be negative'); return { ...p, sellingPrice: price }; };
export const draftTotal = (d) => d.lines.reduce((s, l) => s + multiplyMoney(l.unitPrice, l.quantity) - (l.discount ?? 0n), 0n);
export function confirmSale(d, p, key, now = new Date().toISOString()) { if (!key || !d.lines.length)
    throw new Error('Sale requires lines and idempotency key'); const subtotal = d.lines.reduce((s, l) => s + multiplyMoney(l.unitPrice, l.quantity), 0n), discount = d.lines.reduce((s, l) => s + (l.discount ?? 0n), 0n), total = subtotal - discount; if (total < 0n || p.amount !== total)
    throw new Error('Payment must equal sale total'); return { ...d, status: 'confirmed', subtotal, discount, total, payment: p, confirmedAt: now, idempotencyKey: key }; }
export class InventoryLedger {
    entries = new Map();
    append(e) { if (this.entries.has(e.id))
        return false; if (!Number.isInteger(e.delta))
        throw new Error('Inventory delta must be integer'); this.entries.set(e.id, e); return true; }
    balance(pid, opening = 0) { return opening + [...this.entries.values()].filter(e => e.productId === pid).reduce((n, e) => n + e.delta, 0); }
    all() { return [...this.entries.values()]; }
}
export class UdhaarLedger {
    entries = new Map();
    append(e) { if (e.amount <= 0n)
        throw new Error('Amount must be positive'); if (this.entries.has(e.id))
        return false; this.entries.set(e.id, e); return true; }
    balance(cid) { return [...this.entries.values()].filter(e => e.customerId === cid).reduce((n, e) => n + (e.kind === 'credit' ? e.amount : -e.amount), 0n); }
}
const transitions = { draft: ['placed', 'cancelled'], placed: ['packed', 'cancelled'], packed: ['ready', 'cancelled'], ready: ['completed', 'cancelled'], completed: [], cancelled: [] };
export function transitionOrder(s, n) { if (!transitions[s].includes(n))
    throw new Error(`Invalid order transition ${s} -> ${n}`); return n; }
export function suggestPrice(cost, marginPercent, roundTo = 100n) { if (cost < 0n || marginPercent < 0 || roundTo <= 0n)
    throw new Error('Invalid pricing input'); const raw = cost * BigInt(Math.round((100 + marginPercent) * 100)) / 10000n; return ((raw + roundTo - 1n) / roundTo) * roundTo; }
export const can = (s, p) => s.active && s.permissions.includes(p);
export function audit(a, p, r) { if (!can(a, p))
    throw new Error('Forbidden'); return { ...r, actorId: a.id }; }
;
export class HttpJsonClient {
    baseUrl;
    token;
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
        const u = new URL(baseUrl);
        if (!['http:', 'https:'].includes(u.protocol))
            throw new Error('Provider URL must be HTTP(S)');
    }
    async post(path, body) { const r = await fetch(new URL(path, this.baseUrl), { method: 'POST', headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(body) }); if (!r.ok)
        throw new Error(`Provider request failed (${r.status})`); return await r.json(); }
}
