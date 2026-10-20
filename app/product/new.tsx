import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Header, Screen, colors } from '@/src/components/ui';
import { catalogueOwner, openCatalogue } from '@/src/lib/catalogue';
import { paise, type Unit } from '../../packages/domain/src';
export default function NewProduct() {
  const router = useRouter(); const [name, setName] = useState(''); const [unit, setUnit] = useState<Unit>('piece'); const [price, setPrice] = useState(''); const [reorder, setReorder] = useState('0'); const [error, setError] = useState<string | null>(null);
  function save() { try { if (!reorder.trim()) throw new Error('Reorder level is required'); const product = openCatalogue().products.create({ name: name.trim(), aliases: [], unit, sellingPrice: price.trim() ? paise(price) : undefined, costPrice: undefined, reorderLevel: Number(reorder) }, catalogueOwner); router.replace(`/product/${product.id}`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save product.'); } }
  return <Screen><Header title="New product" subtitle="Add to the local catalogue" /><Card>{error && <Text style={{ color: colors.red }}>{error}</Text>}<Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Toor dal" /><Field label="Unit" value={unit} onChangeText={value => setUnit(value as Unit)} placeholder="piece, kg, litre" /><Field label="Selling price (₹)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" /><Field label="Reorder level" value={reorder} onChangeText={setReorder} keyboardType="number-pad" /><Button label="Save product" onPress={save} /><Button label="Cancel" variant="ghost" onPress={() => router.back()} /></Card></Screen>;
}
