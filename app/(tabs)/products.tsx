import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Header, Row, Screen, colors } from '@/src/components/ui';
import { createExpoExecutor, getDatabase, initializeDatabase } from '@/src/lib/database';
import { ProductRepository } from '@/src/lib/repositories';
import { formatRupees } from '../../packages/domain/src/index';
export default function Products() {
  const router = useRouter(); const [items, setItems] = useState<ReturnType<ProductRepository['search']>>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const executor = useMemo(() => { const db = getDatabase(); return db ? createExpoExecutor(db) : undefined; }, []);
  useEffect(() => { try { initializeDatabase(); if (executor) setItems(new ProductRepository(executor).search()); else setError('SQLite is available in an Android development build, not the web preview.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open catalogue.'); } finally { setLoading(false); } }, [executor]);
  return <Screen><Header title="Products" subtitle={`${items.length} saved catalogue items`} action={<Button label="New bill" icon="add" onPress={() => router.push('/bill/new')} />} />{loading && <ActivityIndicator color={colors.teal} accessibilityLabel="Loading products" />}{error && <Card><Text style={{ color: colors.red }}>{error}</Text></Card>}{!loading && !error && items.length === 0 && <Card><Text style={{ color: colors.muted }}>Your saved catalogue is empty. Add products before creating a bill.</Text></Card>}{items.map(product => <Card key={product.id}><Row title={product.name} detail={`${product.sellingPrice === undefined ? 'Price not configured' : formatRupees(product.sellingPrice)} / ${product.unit} · ${product.stock} in stock`} icon="cube-outline" /></Card>)}<Button label="Manage inventory" variant="secondary" icon="layers-outline" onPress={() => router.push('/inventory')} /></Screen>;
}
