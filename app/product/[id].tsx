import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Field, Header, Row, Screen, colors } from '@/src/components/ui';
import { catalogueOwner, openCatalogue, operationKey } from '@/src/lib/catalogue';
import type { InventoryMovement } from '@/src/lib/repositories';
import { paise, type Product, type Unit } from '../../packages/domain/src';

export default function ProductDetail() {
  const router = useRouter(); const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [price, setPrice] = useState(''); const [reorder, setReorder] = useState('');
  const [quantity, setQuantity] = useState(''); const [reason, setReason] = useState('');
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { try {
    const repositories = openCatalogue(); const saved = repositories.products.get(id);
    if (!saved?.active) throw new Error('Active product not found.');
    setProduct(saved); setPrice(saved.sellingPrice === undefined ? '' : `${saved.sellingPrice / 100n}.${String(saved.sellingPrice % 100n).padStart(2, '0')}`); setReorder(String(saved.reorderLevel)); setMovements(repositories.inventory.movements(id));
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load product.'); } }, [id]);
  function save() {
    if (!product) return;
    try { if (!reorder.trim()) throw new Error('Reorder level is required'); openCatalogue().products.update(product.id, { ...product, sellingPrice: price.trim() ? paise(price) : undefined, reorderLevel: Number(reorder) }, catalogueOwner); router.back(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update product.'); }
  }
  function move(restock: boolean) {
    if (!product) return;
    try {
      const repositories = openCatalogue(); const key = operationKey();
      if (restock) repositories.inventory.restock(product.id, Number(quantity), key, catalogueOwner);
      else repositories.inventory.adjust(product.id, Number(quantity), reason, key, catalogueOwner);
      const saved = repositories.products.get(product.id)!;
      setProduct({ ...product, stock: saved.stock }); setMovements(repositories.inventory.movements(product.id)); setQuantity(''); setReason(''); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record movement.'); }
  }
  function archive() {
    if (!product) return;
    Alert.alert('Archive product?', 'The product will leave the active catalogue. Its history is retained.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => {
      try { openCatalogue().products.archive(product.id, catalogueOwner); router.back(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not archive product.'); }
    } }]);
  }
  return <Screen><Header title={product?.name ?? 'Product'} subtitle={product ? `${product.stock} ${product.unit} in stock` : undefined} />
    {error && <Card><Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text></Card>}
    {product && <><Card>
      <Field label="Name" value={product.name} onChangeText={name => setProduct({ ...product, name })} />
      <Field label="Unit (piece, packet, box, carton, kg, g, litre, ml)" value={product.unit} onChangeText={unit => setProduct({ ...product, unit: unit as Unit })} autoCapitalize="none" />
      <Field label="Selling price (₹)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <Field label="Reorder level" value={reorder} onChangeText={setReorder} keyboardType="number-pad" />
      <Button label="Save changes" onPress={save} />
    </Card><Card>
      <Text style={{ color: colors.secondary }}>Restock adds units. For adjustments enter a signed whole number, e.g. -2 for damaged stock.</Text>
      <Field label="Quantity / adjustment delta" value={quantity} onChangeText={setQuantity} keyboardType="numbers-and-punctuation" />
      <Field label="Adjustment reason" value={reason} onChangeText={setReason} />
      <Button label="Restock" onPress={() => move(true)} />
      <Button label="Record adjustment" variant="secondary" onPress={() => move(false)} />
    </Card><Card><Text style={{ color: colors.text }}>Movement history</Text>
      {movements.length === 0 && <Text style={{ color: colors.secondary }}>No movements recorded yet.</Text>}
      {movements.map(movement => <Row key={movement.id} title={`${movement.delta > 0 ? '+' : ''}${movement.delta} · ${movement.reason}`} detail={movement.created_at} />)}
    </Card><Button label="Archive product" variant="ghost" onPress={archive} /></>}
  </Screen>;
}
