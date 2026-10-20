import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, Field, Header, Row, Screen, SectionTitle, Stat, colors } from '@/src/components/ui';
import { createExpoExecutor, getDatabase, initializeDatabase } from '@/src/lib/database';
import { CustomerRepository, UdhaarRepository, type Customer, type UdhaarEntry } from '@/src/lib/repositories';
import type { SqliteExecutor } from '@/src/lib/sqlite-schema';
import { formatRupees } from '../../packages/domain/src/index';
import type { Staff } from '../../packages/domain/src/index';

const staff: Staff = { id: 'local-owner', name: 'Shop owner', active: true, permissions: ['udhaar.adjust'] };
export default function Udhaar() {
  const [customers, setCustomers] = useState<Array<Customer & { balance: bigint }>>([]); const [query, setQuery] = useState(''); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [error, setError] = useState<string | null>(null);
  const [executor, setExecutor] = useState<SqliteExecutor>();
  const [selected, setSelected] = useState<Customer | null>(null); const [history, setHistory] = useState<UdhaarEntry[]>([]); const [amount, setAmount] = useState(''); const [method, setMethod] = useState<'cash' | 'upi'>('cash');
  const refresh = (text = query) => { try { if (executor) { const repo = new UdhaarRepository(executor); setCustomers(repo.balances(text)); if (selected) setHistory(repo.history(selected.id)); } } catch (cause) { setError(String(cause)); } };
  useFocusEffect(useCallback(() => { try { initializeDatabase(); const db = getDatabase(); if (!db) throw new Error('SQLite is unavailable in the web preview. Use a native development build.'); const sql = createExpoExecutor(db); setExecutor(sql); setCustomers(new UdhaarRepository(sql).balances(query)); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load customers.'); } }, [query]));
  const total = customers.reduce((sum, customer) => sum + customer.balance, 0n);
  function addCustomer() { if (!executor) return setError('SQLite is unavailable in the web preview.'); try { new CustomerRepository(executor).create({ name, phone }); setName(''); setPhone(''); refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save customer.'); } }
  function pay(customer: Customer) { if (!executor) return; setSelected(customer); setAmount(''); setHistory(new UdhaarRepository(executor).history(customer.id)); }
  function savePayment() { try { if (!executor || !selected) return; if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) throw new Error('Enter a positive rupee amount with up to two decimal places.'); const [whole, fraction = ''] = amount.trim().split('.'); const paise = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')); new UdhaarRepository(executor).recordPayment(selected.id, paise, method, `payment:${selected.id}:${Date.now()}:${Math.random()}`, staff); setAmount(''); setError(null); refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record payment.'); } }
  return <Screen>
    <Header title="Udhaar" subtitle="Track credit without losing trust" />
    <Stat label={query ? 'Matching customers outstanding' : 'Total outstanding'} value={formatRupees(total)} />
    {error && <Card><Text style={{ color: colors.text }}>{error}</Text></Card>}
    <Field label="Search name or phone" value={query} onChangeText={setQuery} />
    <Card>{customers.length ? customers.map(customer => <Row key={customer.id} title={customer.name} detail={`${formatRupees(customer.balance)} outstanding · ${customer.phone || 'No phone'}`} icon="person-outline" onPress={() => pay(customer)} />) : <Text style={{ color: colors.secondary }}>No matching customers.</Text>}</Card>
    {selected && <><SectionTitle>{selected.name}</SectionTitle><Card>
      <Text style={{ color: colors.secondary }}>Customer ID: {selected.id}</Text>
      <Field label="Payment amount (rupees)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <Button label={`Method: ${method.toUpperCase()} (tap to change)`} variant="secondary" onPress={() => setMethod(method === 'cash' ? 'upi' : 'cash')} />
      <Button label="Record payment" onPress={savePayment} />
      <SectionTitle>Credit and payment history</SectionTitle>
      {history.length ? history.map(entry => <Row key={entry.id} title={`${entry.kind === 'credit' ? 'Credit' : 'Payment'} · ${formatRupees(entry.amount)}`} detail={`${entry.reason || ''} · ${new Date(entry.createdAt).toLocaleString()} · ${entry.referenceId || ''}`} icon="receipt-outline" />) : <Text style={{ color: colors.secondary }}>No ledger entries yet.</Text>}
    </Card></>}
    <SectionTitle>Add customer</SectionTitle><Card><Field label="Name" value={name} onChangeText={setName} /><Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><Button label="Save customer" onPress={addCustomer} /></Card>
  </Screen>;
}
