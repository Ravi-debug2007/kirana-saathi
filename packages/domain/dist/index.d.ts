export type Paise = bigint;
export declare function paise(value: number | string | bigint): Paise;
export declare const addMoney: (...values: Paise[]) => bigint;
export declare function multiplyMoney(price: Paise, quantity: number): Paise;
export declare function formatRupees(value: Paise): string;
export type Unit = 'piece' | 'packet' | 'box' | 'carton' | 'kg' | 'g' | 'litre' | 'ml';
export type Product = {
    id: string;
    sku?: string;
    name: string;
    brand?: string;
    variant?: string;
    aliases: string[];
    unit: Unit;
    sellingPrice?: Paise;
    costPrice?: Paise;
    stock: number;
    reorderLevel: number;
    barcode?: string;
    expiryDate?: string;
    active: boolean;
};
export declare function createProduct(input: Omit<Product, 'active' | 'aliases' | 'reorderLevel'> & Partial<Pick<Product, 'active' | 'aliases' | 'reorderLevel'>>): Product;
export declare const changeProductPrice: (product: Product, price: Paise) => {
    sellingPrice: bigint;
    id: string;
    sku?: string;
    name: string;
    brand?: string;
    variant?: string;
    aliases: string[];
    unit: Unit;
    costPrice?: Paise;
    stock: number;
    reorderLevel: number;
    barcode?: string;
    expiryDate?: string;
    active: boolean;
};
export type DraftLine = {
    productId: string;
    name: string;
    quantity: number;
    unitPrice?: Paise;
    unit: Unit;
    uncertain?: boolean;
    priceOverride?: Paise;
};
export type BillingDraft = {
    id: string;
    lines: DraftLine[];
    customerId?: string;
    notes?: string;
    source?: 'manual' | 'paste' | 'voice';
};
export type Payment = {
    method: 'cash' | 'upi' | 'card' | 'credit';
    amount: Paise;
};
export type Sale = BillingDraft & {
    status: 'confirmed';
    subtotal: Paise;
    total: Paise;
    payment: Payment;
    confirmedAt: string;
    idempotencyKey: string;
};
export declare function draftTotal(draft: BillingDraft): Paise;
export declare function confirmSale(draft: BillingDraft, payment: Payment, key: string, now?: string): Sale;
export type InventoryReason = 'opening' | 'purchase' | 'sale' | 'customer-return' | 'supplier-return' | 'adjustment' | 'damage' | 'expiry' | 'correction';
export type InventoryEntry = {
    id: string;
    productId: string;
    delta: number;
    reason: InventoryReason;
    referenceId?: string;
    createdAt: string;
};
export declare class InventoryLedger {
    private readonly entries;
    append(entry: InventoryEntry): boolean;
    balance(productId: string, opening?: number): number;
    all(): InventoryEntry[];
}
export type UdhaarEntry = {
    id: string;
    customerId: string;
    amount: Paise;
    kind: 'credit' | 'payment' | 'adjustment';
    referenceId?: string;
    reason?: string;
    createdAt: string;
};
export declare class UdhaarLedger {
    private readonly entries;
    append(entry: UdhaarEntry): boolean;
    balance(customerId: string): Paise;
    all(): UdhaarEntry[];
}
export type OrderStatus = 'Received' | 'Confirmed' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';
export declare function transitionOrder(status: OrderStatus, next: OrderStatus): OrderStatus;
export type OrderStatusEvent = {
    status: OrderStatus;
    at: string;
    actorId: string;
};
export declare function suggestPrice(cost: Paise, marginPercent: number, roundTo?: Paise): Paise;
export declare function normalizeSearch(text: string): string;
export declare function matchProducts(query: string, products: Product[]): Product[];
export type ParsedItem = {
    text: string;
    quantity: number;
    unit?: Unit;
    candidates: Product[];
    uncertain: boolean;
};
export declare function parseOrderText(text: string, products: Product[]): ParsedItem[];
export type Permission = 'products.read' | 'products.write' | 'sales.create' | 'sales.cancel' | 'inventory.adjust' | 'udhaar.adjust' | 'reports.read' | 'settings.manage' | 'staff.manage';
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
export declare const can: (staff: Staff, permission: Permission) => boolean;
export declare function audit(staff: Staff, permission: Permission, record: Omit<AuditRecord, 'actorId'>): AuditRecord;
export interface ProviderAdapter {
    readonly id: string;
    testConnection(): Promise<{
        ok: true;
        model?: string;
    }>;
    parseOrder(input: {
        text: string;
        language?: string;
    }): Promise<unknown>;
}
export interface MessagingProvider {
    send(message: {
        to: string;
        body: string;
    }): Promise<{
        messageId: string;
        status: 'queued' | 'sent' | 'failed';
    }>;
}
export declare class HttpJsonClient {
    private readonly baseUrl;
    private readonly token?;
    constructor(baseUrl: string, token?: string | undefined);
    post<T>(path: string, body: unknown): Promise<T>;
}
