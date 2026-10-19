export type Paise = bigint;
export declare function paise(v: number | string | bigint): Paise;
export declare const addMoney: (...v: Paise[]) => bigint;
export declare const multiplyMoney: (a: Paise, q: number) => bigint;
export declare const formatRupees: (a: Paise) => string;
export type Product = {
    id: string;
    sku?: string;
    name: string;
    unit: string;
    sellingPrice: Paise;
    costPrice?: Paise;
    stock: number;
    reorderLevel?: number;
    active: boolean;
};
export declare function createProduct(i: Omit<Product, 'active'> & {
    active?: boolean;
}): Product;
export declare const changeProductPrice: (p: Product, price: Paise) => {
    sellingPrice: bigint;
    id: string;
    sku?: string;
    name: string;
    unit: string;
    costPrice?: Paise;
    stock: number;
    reorderLevel?: number;
    active: boolean;
};
export type DraftLine = {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: Paise;
    discount?: Paise;
};
export type BillingDraft = {
    id: string;
    lines: DraftLine[];
    customerId?: string;
    notes?: string;
};
export type Payment = {
    method: 'cash' | 'upi' | 'card' | 'credit';
    amount: Paise;
};
export type Sale = BillingDraft & {
    status: 'confirmed';
    subtotal: Paise;
    discount: Paise;
    total: Paise;
    payment: Payment;
    confirmedAt: string;
    idempotencyKey: string;
};
export declare const draftTotal: (d: BillingDraft) => bigint;
export declare function confirmSale(d: BillingDraft, p: Payment, key: string, now?: string): Sale;
export type InventoryEntry = {
    id: string;
    productId: string;
    delta: number;
    reason: 'purchase' | 'sale' | 'adjustment' | 'return';
    referenceId?: string;
    createdAt: string;
};
export declare class InventoryLedger {
    private entries;
    append(e: InventoryEntry): boolean;
    balance(pid: string, opening?: number): number;
    all(): InventoryEntry[];
}
export type UdhaarEntry = {
    id: string;
    customerId: string;
    amount: Paise;
    kind: 'credit' | 'payment' | 'adjustment';
    referenceId?: string;
    createdAt: string;
};
export declare class UdhaarLedger {
    private entries;
    append(e: UdhaarEntry): boolean;
    balance(cid: string): bigint;
}
export type OrderStatus = 'draft' | 'placed' | 'packed' | 'ready' | 'completed' | 'cancelled';
export declare function transitionOrder(s: OrderStatus, n: OrderStatus): OrderStatus;
export declare function suggestPrice(cost: Paise, marginPercent: number, roundTo?: Paise): bigint;
export type Permission = 'products.read' | 'products.write' | 'sales.create' | 'sales.cancel' | 'inventory.adjust' | 'udhaar.adjust' | 'staff.manage';
export type Staff = {
    id: string;
    name: string;
    permissions: readonly Permission[];
    active: boolean;
};
export type AuditRecord = {
    id: string;
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    metadata?: Record<string, string>;
    at: string;
};
export declare const can: (s: Staff, p: Permission) => boolean;
export declare function audit(a: Staff, p: Permission, r: Omit<AuditRecord, 'actorId'>): AuditRecord;
export interface PaymentProvider {
    readonly name: string;
    createPayment(r: {
        amount: Paise;
        reference: string;
    }): Promise<{
        providerId: string;
        status: 'pending' | 'paid' | 'failed';
    }>;
    verifyPayment(id: string): Promise<{
        status: 'pending' | 'paid' | 'failed';
    }>;
}
export interface MessagingProvider {
    send(m: {
        to: string;
        body: string;
    }): Promise<{
        messageId: string;
        status: 'queued' | 'sent' | 'failed';
    }>;
}
export declare class HttpJsonClient {
    private baseUrl;
    private token?;
    constructor(baseUrl: string, token?: string | undefined);
    post<T>(path: string, body: unknown): Promise<T>;
}
