import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const screens = [
  ['index', 'Home', 'home-outline'], ['products', 'Products', 'cube-outline'],
  ['orders', 'Orders', 'receipt-outline'], ['udhaar', 'Udhaar', 'people-outline'],
  ['settings', 'Settings', 'settings-outline'],
] as const;

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0F766E', tabBarInactiveTintColor: '#81908D', tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6 } }}>
    {screens.map(([name, title, icon]) => <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color, size }) => <Ionicons name={icon} color={color} size={size} /> }} />)}
  </Tabs>;
}
