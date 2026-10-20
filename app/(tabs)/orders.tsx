import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, Field, Header, Row, Screen, SectionTitle, colors } from '@/src/components/ui';
import { createExpoExecutor, getDatabase, initializeDatabase } from '@/src/lib/database';
import { BillingRepository, CustomerRepository, type StoredBill } from '@/src/lib/repositories';
import { formatRupees } from '../../packages/domain/src/index';

export default function Orders() {
  const [bills, setBills] = useState<StoredBill[]>([]);
  const [repository, setRepository] = useState<BillingRepository>();
  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<StoredBill | null>(null);
  const [corrections, setCorrections] = useState<ReturnType<BillingRepository['corrections']>>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    try {
      initializeDatabase(); const db = getDatabase(); if (!db) throw new Error('SQLite is unavailable in the web preview. Use a native development build.');
      const executor = createExpoExecutor(db); const repo = new BillingRepository(executor); setRepository(repo); setBills(repo.listRecent(100));
      setNames(Object.fromEntries(new CustomerRepository(executor).list().map(customer => [customer.id, customer.name]))); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load bills.'); }
  }, []));
  function openBill(bill: StoredBill) { try { setSelected(repository?.get(bill.id) ?? null); setCorrections(repository?.corrections(bill.id) ?? []); setReason(''); } catch (cause) { setError(String(cause)); } }
  function correct() {
    try { if (!repository || !selected) return; repository.recordCorrection(selected.id, { id: 'local-owner', name: 'Shop owner', active: true, permissions: ['sales.cancel'] }, reason); setCorrections(repository.corrections(selected.id)); setReason(''); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save correction note.'); }
  }
  return <Screen><Header title="Orders" subtitle="Latest 100 stored bills, including drafts" />
    {error && <Card><Text style={{ color: colors.text }}>{error}</Text></Card>}
    <Card>{bills.length ? bills.map(bill => <Row key={bill.id} title={`${names[bill.customerId || ''] || 'Walk-in'} · ${bill.id}`} detail={`${formatRupees(bill.total)} · ${bill.status} · ${new Date(bill.createdAt).toLocaleString()}`} icon="receipt-outline" onPress={() => openBill(bill)} />) : <Text style={{ color: colors.secondary }}>No stored bills yet.</Text>}</Card>
    {selected && <><SectionTitle>Bill details</SectionTitle><Card>
      <Text style={{ color: colors.text }}>{selected.id} · {selected.status} · {selected.paymentMethod || 'Unpaid draft'}</Text>
      {selected.lines.map((line, index) => <Row key={`${line.productId}:${index}`} title={`${line.name} × ${line.quantity} ${line.unit}`} detail={`${formatRupees(line.unitPrice ?? 0n)} each · ${formatRupees((line.unitPrice ?? 0n) * BigInt(line.quantity))}`} />)}
      <Text style={{ color: colors.gold }}>Total: {formatRupees(selected.total)}</Text>
      {selected.notes && <Text style={{ color: colors.secondary }}>{selected.notes}</Text>}
      <SectionTitle>Correction notes</SectionTitle><Text style={{ color: colors.secondary }}>Notes are append-only. They do not change totals, stock, or credit balances.</Text>
      {corrections.map(item => <Row key={item.id} title={item.reason} detail={`${item.actor_id} · ${new Date(item.created_at).toLocaleString()}`} />)}
      {!corrections.length && <Text style={{ color: colors.secondary }}>No corrections recorded.</Text>}
      {selected.status === 'confirmed' && <><Field label="Correction reason" value={reason} onChangeText={setReason} multiline /><Button label="Save correction note" onPress={correct} /></>}
    </Card></>}
  </Screen>;
}
