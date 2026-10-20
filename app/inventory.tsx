import { useCallback, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Header, Row, Screen, colors } from '@/src/components/ui';
import { openCatalogue } from '@/src/lib/catalogue';
import type { Product } from '../packages/domain/src';

export default function Inventory() {
  const router = useRouter(); const [items, setItems] = useState<Product[]>([]); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => { try { setItems(openCatalogue().products.list()); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open inventory.'); } finally { setLoading(false); } }, []);
  useFocusEffect(refresh);
  const low = items.filter(item => item.stock <= item.reorderLevel);
  return <Screen><Header title="Inventory" subtitle={`${items.length} live catalogue items`} action={<Button label="New product" icon="add" onPress={() => router.push('/product/new')} />} />
    {loading && <ActivityIndicator color={colors.teal} />}{error && <Card><Text style={{ color: colors.red }}>{error}</Text></Card>}
    {!loading && !error && <Card style={{ backgroundColor: colors.elevated, borderColor: colors.gold }}><Text style={{ color: colors.gold, fontWeight: '800' }}>{low.length} item{low.length === 1 ? '' : 's'} need a restock soon</Text><Text style={{ color: colors.secondary, marginTop: 5 }}>Restock or adjust quantities against the local ledger.</Text></Card>}
    {!loading && !error && items.length === 0 && <Card><Text style={{ color: colors.muted }}>Your inventory is empty. Add a product to begin.</Text></Card>}
    {items.map(item => <Card key={item.id}><Row title={item.name} detail={`${item.stock} ${item.unit}${item.stock === 1 ? '' : 's'} · reorder at ${item.reorderLevel}`} icon={item.stock <= item.reorderLevel ? 'warning-outline' : 'checkmark-circle-outline'} onPress={() => router.push(`/product/${item.id}`)} /><Button label="Restock / adjust" variant="secondary" onPress={() => router.push(`/product/${item.id}?inventory=1`)} /></Card>)}</Screen>;
}
