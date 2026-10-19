import { describe, expect, it } from 'vitest';
import { addMoney, audit, can, confirmSale, createProduct, formatRupees, InventoryLedger, matchProducts, paise, parseOrderText, suggestPrice, transitionOrder, UdhaarLedger } from './index.js';

describe('money', () => {
  it('uses exact paise', () => { expect(paise('12.30')).toBe(1230n); expect(formatRupees(addMoney(1n, 99n))).toBe('₹1.00'); });
  it('rejects precision', () => expect(() => paise('1.001')).toThrow());
});
describe('sales and ledgers', () => {
  it('confirms and deduplicates inventory', () => {
    const sale = confirmSale({ id: 'd', source: 'manual', lines: [{ productId: 'p', name: 'Rice', quantity: 2, unit: 'kg', unitPrice: paise('10') }] }, { method: 'cash', amount: paise('20') }, 'key');
    expect(sale.total).toBe(2000n);
    const ledger = new InventoryLedger();
    expect(ledger.append({ id: 'x', productId: 'p', delta: -2, reason: 'sale', createdAt: '' })).toBe(true);
    expect(ledger.append({ id: 'x', productId: 'p', delta: -2, reason: 'sale', createdAt: '' })).toBe(false);
    expect(ledger.balance('p', 10)).toBe(8);
  });
  it('tracks Udhaar credit and partial payment', () => { const ledger = new UdhaarLedger(); ledger.append({ id: 'a', customerId: 'c', amount: 100n, kind: 'credit', createdAt: '' }); ledger.append({ id: 'b', customerId: 'c', amount: 40n, kind: 'payment', createdAt: '' }); expect(ledger.balance('c')).toBe(60n); });
});
describe('rules and matching', () => {
  it('requires explicit order progression', () => { expect(transitionOrder('Received', 'Confirmed')).toBe('Confirmed'); expect(() => transitionOrder('Received', 'Completed')).toThrow(); });
  it('suggests a rounded, non-authoritative price', () => expect(suggestPrice(paise('10'), 20, 100n)).toBe(1200n));
  it('matches aliases and parses quantities', () => { const product = createProduct({ id: 'p', name: 'Rice', aliases: ['biyyam'], unit: 'kg', sellingPrice: 100n, stock: 1 }); expect(matchProducts('biyyam', [product])).toHaveLength(1); expect(parseOrderText('2 kg biyyam', [product])[0].quantity).toBe(2); });
  it('enforces permission audit', () => { const staff = { id: 'u', name: '', permissions: ['sales.create'] as const, active: true }; expect(can(staff, 'sales.create')).toBe(true); expect(audit(staff, 'sales.create', { id: 'a', action: 'create', entity: 'sale', entityId: '1', at: '' }).actorId).toBe('u'); });
});
