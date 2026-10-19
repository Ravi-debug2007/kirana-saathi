export function paise(value) {
    if (typeof value === 'bigint')
        return value;
    const text = String(value).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text))
        throw new Error('Amount must be non-negative rupees with at most 2 decimals');
    const [rupees, fraction = ''] = text.split('.');
    return BigInt(rupees) * 100n + BigInt((fraction + '00').slice(0, 2));
}
export const addMoney = (...values) => values.reduce((sum, value) => sum + value, 0n);
export function multiplyMoney(price, quantity) {
    if (!Number.isInteger(quantity) || quantity < 0)
        throw new Error('Quantity must be a non-negative integer');
    return price * BigInt(quantity);
}
export function formatRupees(value) {
    if (value < 0n)
        return `-${formatRupees(-value)}`;
    return `₹${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
export function createProduct(input) {
    if (!input.id || !input.name || input.stock < 0 || (input.sellingPrice !== undefined && input.sellingPrice < 0n))
        throw new Error('Invalid product');
    return { ...input, aliases: input.aliases ?? [], reorderLevel: input.reorderLevel ?? 0, active: input.active ?? true };
}
export const changeProductPrice = (product, price) => price < 0n ? (() => { throw new Error('Price cannot be negative'); })() : { ...product, sellingPrice: price };
export function draftTotal(draft) {
    return draft.lines.reduce((sum, line) => sum + multiplyMoney(line.priceOverride ?? line.unitPrice ?? 0n, line.quantity), 0n);
}
export function confirmSale(draft, payment, key, now = new Date().toISOString()) {
    if (!key || !draft.lines.length || draft.lines.some(line => !line.unitPrice && !line.priceOverride))
        throw new Error('Sale requires priced lines and idempotency key');
    const subtotal = draftTotal(draft);
    if (payment.amount !== subtotal)
        throw new Error('Payment must equal sale total');
    return { ...draft, status: 'confirmed', subtotal, total: subtotal, payment, confirmedAt: now, idempotencyKey: key };
}
export class InventoryLedger {
    entries = new Map();
    append(entry) { if (this.entries.has(entry.id))
        return false; if (!Number.isInteger(entry.delta))
        throw new Error('Inventory delta must be integer'); this.entries.set(entry.id, entry); return true; }
    balance(productId, opening = 0) { return opening + [...this.entries.values()].filter(entry => entry.productId === productId).reduce((sum, entry) => sum + entry.delta, 0); }
    all() { return [...this.entries.values()]; }
}
export class UdhaarLedger {
    entries = new Map();
    append(entry) { if (entry.amount <= 0n)
        throw new Error('Amount must be positive'); if (this.entries.has(entry.id))
        return false; this.entries.set(entry.id, entry); return true; }
    balance(customerId) { return [...this.entries.values()].filter(entry => entry.customerId === customerId).reduce((sum, entry) => sum + (entry.kind === 'credit' ? entry.amount : -entry.amount), 0n); }
    all() { return [...this.entries.values()]; }
}
const orderTransitions = { Received: ['Confirmed', 'Cancelled'], Confirmed: ['Preparing', 'Cancelled'], Preparing: ['Ready', 'Cancelled'], Ready: ['Completed', 'Cancelled'], Completed: [], Cancelled: [] };
export function transitionOrder(status, next) { if (!orderTransitions[status].includes(next))
    throw new Error(`Invalid order transition ${status} -> ${next}`); return next; }
export function suggestPrice(cost, marginPercent, roundTo = 100n) {
    if (cost < 0n || marginPercent < 0 || roundTo <= 0n)
        throw new Error('Invalid pricing input');
    const raw = cost * BigInt(Math.round((100 + marginPercent) * 100)) / 10000n;
    return ((raw + roundTo - 1n) / roundTo) * roundTo;
}
export function normalizeSearch(text) { return text.normalize('NFKC').toLocaleLowerCase('en-IN').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
export function matchProducts(query, products) {
    const needle = normalizeSearch(query);
    return products.filter(product => product.active && [product.name, product.brand, product.variant, product.sku, product.barcode, ...product.aliases].filter(Boolean).some(value => normalizeSearch(value).includes(needle)));
}
const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, एक: 1, दो: 2, तीन: 3, ఒకటి: 1, రెండు: 2, మూడు: 3 };
export function parseOrderText(text, products) {
    return text.split(/,|\band\b|\n/iu).map(part => part.trim()).filter(Boolean).map(part => {
        const quantityMatch = part.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|एक|दो|तीन|ఒకటి|రెండు|మూడు)\b/iu);
        const quantity = quantityMatch ? Number(numberWords[quantityMatch[1].toLocaleLowerCase()] ?? quantityMatch[1]) : 1;
        const unitMatch = part.match(/\b(kg|kilo(?:s)?|g|gram(?:s)?|litre|liter|l|ml|packet(?:s)?|pack(?:s)?|piece(?:s)?|box(?:es)?|carton(?:s)?)\b/iu);
        const unit = unitMatch ? { kilos: 'kg', kilo: 'kg', kg: 'kg', grams: 'g', gram: 'g', litres: 'litre', liter: 'litre', l: 'litre', packets: 'packet', packs: 'packet', pieces: 'piece', boxes: 'box', cartons: 'carton' }[unitMatch[1].toLocaleLowerCase()] ?? unitMatch[1].toLocaleLowerCase() : undefined;
        const productText = part.replace(quantityMatch?.[0] ?? '', '').replace(unitMatch?.[0] ?? '', '').trim();
        const candidates = matchProducts(productText, products);
        return { text: productText, quantity, unit, candidates, uncertain: candidates.length !== 1 || !candidates[0].sellingPrice };
    });
}
export const can = (staff, permission) => staff.active && staff.permissions.includes(permission);
export function audit(staff, permission, record) { if (!can(staff, permission))
    throw new Error('Forbidden'); return { ...record, actorId: staff.id }; }
export class HttpJsonClient {
    baseUrl;
    token;
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
        const url = new URL(baseUrl);
        if (!['http:', 'https:'].includes(url.protocol))
            throw new Error('Provider URL must be HTTP(S)');
    }
    async post(path, body) { const response = await fetch(new URL(path, this.baseUrl), { method: 'POST', headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(body) }); if (!response.ok)
        throw new Error(`Provider request failed (${response.status})`); return await response.json(); }
}
