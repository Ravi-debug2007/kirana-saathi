import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const screens = [
  ['index', 'Home', 'home-outline'], ['products', 'Products', 'cube-outline'],
  ['orders', 'Orders', 'receipt-outline'], ['udhaar', 'Udhaar', 'people-outline'],
  ['settings', 'Settings', 'settings-outline'],
] as const;

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#CA8A04', tabBarInactiveTintColor: '#BFA98A', tabBarStyle: { height: 68, paddingBottom: 8, paddingTop: 6, backgroundColor: '#2C1A10', borderTopColor: '#5C3D2E', borderTopWidth: 1 }, tabBarLabelStyle: { fontFamily: 'serif', fontWeight: '700' } }}>
    {screens.map(([name, title, icon]) => <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name={icon} color={color} size={size} /> }} />)}
  </Tabs>;
}
