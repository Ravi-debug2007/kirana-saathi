import { useMemo, useState } from 'react';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import { Alert, Text } from 'react-native';
import { Button, Card, Field, Header, Row, Screen, colors } from '@/src/components/ui';
import { matchProducts, parseOrderText } from '../../packages/domain/src';
import { openCatalogue } from '@/src/lib/catalogue';
import { OrderRepository } from '@/src/lib/repositories';

export default function Voice() {
  const [text, setText] = useState(''); const [status, setStatus] = useState('Ready');
  const products = useMemo(() => { try { return openCatalogue().products.list(); } catch { return []; } }, []);
  const parsed = useMemo(() => text.trim() ? parseOrderText(text, products) : [], [text, products]);
  const speak = () => { if (!text.trim()) { setStatus('Enter or paste an order first'); return; } setStatus('Playing preview'); Speech.speak(text, { onDone: () => setStatus('Ready'), onError: () => setStatus('Speech preview failed') }); };
  const paste = async () => { const value = await Clipboard.getStringAsync(); setText(value); setStatus(value ? 'Pasted from clipboard — review before saving' : 'Clipboard is empty'); };
  const saveOrder = () => { try { const database = openCatalogue(); const order = new OrderRepository(database.executor); order.create({ source: 'paste', message: text, items: parsed }); Alert.alert('Order received', 'The editable order was saved. No stock or revenue was changed.'); setStatus('Saved as Received'); } catch (cause) { setStatus(cause instanceof Error ? cause.message : 'Could not save order'); } };
  return <Screen><Header title="Paste or voice order" subtitle="Create a reviewable order — stock changes only after a sale" /><Card><Text style={{ color: colors.secondary, lineHeight: 21 }}>Paste a WhatsApp message or enter a speech transcript. Matching is based on your saved catalogue; uncertain or unavailable items stay highlighted.</Text></Card><Field label="Customer message or transcript" placeholder="Anna 2 kg rice, 1 litre oil" multiline value={text} onChangeText={value => { setText(value); setStatus('Review parsed items before saving'); }} /><Text style={{ color: colors.secondary, marginBottom: 14 }} accessibilityLiveRegion="polite">{status}</Text>{parsed.length > 0 && <Card><Text style={{ color: colors.gold, fontWeight: '800', marginBottom: 8 }}>REVIEW DRAFT</Text>{parsed.map((item, index) => <Row key={`${item.text}-${index}`} title={`${item.quantity} ${item.unit ?? ''} ${item.text}`} detail={item.candidates.length === 1 ? `Matched: ${item.candidates[0].name}${item.uncertain ? ' · needs review' : ''}` : item.candidates.length === 0 ? 'Unavailable in saved catalogue' : `${item.candidates.length} possible matches`} icon={item.uncertain ? 'warning-outline' : 'checkmark-circle-outline'} />)}<Button label="Save received order" onPress={saveOrder} /></Card>}<Button label="Paste from clipboard" variant="secondary" icon="clipboard-outline" onPress={paste} /><Button label="Preview aloud" icon="volume-high-outline" onPress={speak} /></Screen>;
}
