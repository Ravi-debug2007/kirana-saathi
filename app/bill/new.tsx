import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Text, View } from 'react-native';
import { getDatabase, initializeDatabase, createExpoExecutor } from '@/src/lib/database';
import { BillingRepository, CustomerRepository, ProductRepository, type Customer, type StoredBill } from '@/src/lib/repositories';
import { useRouter } from 'expo-router';
import { formatRupees, type Product, type Staff } from '../../packages/domain/src/index';
import { Button, Card, Field, Header, Row, Screen, SectionTitle, colors } from '@/src/components/ui';

const currentStaff: Staff = { id: 'local-owner', name: 'Shop owner', active: true, permissions: ['sales.create', 'sales.priceOverride', 'sales.cancel', 'udhaar.adjust', 'products.write'] };
type CartLine = { product: Product; quantity: number; priceOverride?: bigint };

export default function NewBill() {
  const router = useRouter();
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'credit'>('cash');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [savedBill, setSavedBill] = useState<StoredBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const executor = useMemo(() => { const database = getDatabase(); return database ? createExpoExecutor(database) : undefined; }, []);
  const productRepository = useMemo(() => executor ? new ProductRepository(executor) : undefined, [executor]);
  const billingRepository = useMemo(() => executor ? new BillingRepository(executor) : undefined, [executor]);
  const total = cart.reduce((sum, line) => sum + (line.priceOverride ?? line.product.sellingPrice ?? 0n) * BigInt(line.quantity), 0n);

  useEffect(() => {
    try { initializeDatabase(); if (productRepository) setProducts(productRepository.search()); else setError('Local SQLite is unavailable in the web preview. Use an Android development build for billing.'); if (executor) setCustomers(new CustomerRepository(executor).search()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open local database.'); }
    finally { setLoading(false); }
  }, [productRepository]);

  function refreshProducts(text: string) { setQuery(text); if (productRepository) setProducts(productRepository.search(text)); }
  function addProduct(product: Product) { setCart(lines => { const existing = lines.find(line => line.product.id === product.id); return existing ? lines.map(line => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...lines, { product, quantity: 1 }]; }); setQuery(''); if (productRepository) setProducts(productRepository.search()); }
  function changeQuantity(productId: string, delta: number) { setCart(lines => lines.map(line => line.product.id === productId ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line).filter(line => line.quantity > 0)); }
  function saveDraft() {
    if (!billingRepository || !cart.length) { setError('Add at least one saved product before saving.'); return; }
    try { const bill = billingRepository.saveDraft({ id: savedBill?.id, customerId: customerId || undefined, lines: cart.map(line => ({ productId: line.product.id, quantity: line.quantity, unit: line.product.unit, unitPrice: line.product.sellingPrice, priceOverride: line.priceOverride })) }, currentStaff); setSavedBill(bill); setError(null); Alert.alert('Draft saved', `Draft ${bill.id} is stored on this device.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this draft.'); }
  }
  function confirmSale() {
    if (!billingRepository || !savedBill) { setError('Save the draft before confirming payment.'); return; }
    try { const bill = billingRepository.confirm(savedBill.id, { method: paymentMethod, amount: total }, `sale:${savedBill.id}`, currentStaff); setSavedBill(bill); setError(null); Alert.alert('Sale confirmed', 'Stock and the sale were updated atomically.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not confirm sale. Nothing was saved.'); }
  }

  return <Screen>
    <Header title="New bill" subtitle="Saved locally until you confirm payment" />
    {loading && <ActivityIndicator color={colors.teal} accessibilityLabel="Loading catalogue" />}
    {error && <Card style={{ borderColor: colors.red }}><Text style={{ color: colors.red }}>{error}</Text></Card>}
    <Field label="Search saved catalogue" placeholder="Rice, oil, barcode or alias" value={query} onChangeText={refreshProducts} />
    {query.length > 0 && <Card>{products.length === 0 ? <Text style={{ color: colors.muted }}>No active products match this search.</Text> : products.map(product => <Row key={product.id} title={product.name} detail={`${product.unit} · ${product.sellingPrice === undefined ? 'Price not configured' : formatRupees(product.sellingPrice)} · stock ${product.stock}`} icon="cube-outline" onPress={() => product.sellingPrice === undefined ? setError(`${product.name} has no selling price. Configure it before billing.`) : addProduct(product)} />)}</Card>}
    <SectionTitle>Bill items</SectionTitle>
    <Card>{cart.length === 0 ? <Text style={{ color: colors.muted }}>No items yet. Search the saved catalogue above.</Text> : cart.map(line => <Row key={line.product.id} title={`${line.product.name} × ${line.quantity}`} detail={formatRupees((line.priceOverride ?? line.product.sellingPrice ?? 0n) * BigInt(line.quantity))} icon="cart-outline" onPress={() => changeQuantity(line.product.id, 1)} />)}</Card>
    <Field label="Find customer for credit (name or phone)" value={customerQuery} onChangeText={text => { setCustomerQuery(text); try { if (executor) setCustomers(new CustomerRepository(executor).search(text)); } catch (cause) { setError(String(cause)); } }} />
    <Card><Text style={{ color: colors.text }}>{customerId ? `Selected: ${customers.find(customer => customer.id === customerId)?.name || customerId}` : 'Walk-in customer'}</Text>{customers.slice(0, 10).map(customer => <Row key={customer.id} title={customer.name} detail={customer.phone || undefined} icon="person-outline" onPress={() => setCustomerId(customer.id)} />)}<Button label="Clear customer" variant="ghost" onPress={() => setCustomerId('')} /><Button label="Manage customers" variant="secondary" onPress={() => router.push('/udhaar')} /></Card>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 }}><Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>Total</Text><Text style={{ fontSize: 22, fontWeight: '800', color: colors.teal }}>{formatRupees(total)}</Text></View>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}><Button label="Cash" variant={paymentMethod === 'cash' ? 'primary' : 'secondary'} onPress={() => setPaymentMethod('cash')} /><Button label="UPI" variant={paymentMethod === 'upi' ? 'primary' : 'secondary'} onPress={() => setPaymentMethod('upi')} /><Button label="Credit" variant={paymentMethod === 'credit' ? 'primary' : 'secondary'} onPress={() => setPaymentMethod('credit')} /></View>
    <View style={{ flexDirection: 'row', gap: 10 }}><Button label="Save draft" variant="secondary" onPress={saveDraft} /><Button label={savedBill?.status === 'confirmed' ? 'Confirmed' : 'Confirm sale'} onPress={confirmSale} /></View>
    <Button label="View saved bill history" variant="ghost" onPress={() => router.push('/orders')} />
  </Screen>;
}
