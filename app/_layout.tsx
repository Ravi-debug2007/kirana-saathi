import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
export default function Layout(){return <><StatusBar style="light"/><Stack screenOptions={{headerShown:false}}><Stack.Screen name="(tabs)"/><Stack.Screen name="bill/new" options={{presentation:'modal'}}/><Stack.Screen name="tools/scan" options={{presentation:'modal'}}/><Stack.Screen name="tools/voice" options={{presentation:'modal'}}/></Stack></>}
