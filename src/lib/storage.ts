import AsyncStorage from '@react-native-async-storage/async-storage';
export interface LocalStore { get<T>(key:string,fallback:T):Promise<T>; set<T>(key:string,value:T):Promise<void> }
/** Screens depend on this boundary, not on a storage vendor. Replace the adapter with expo-sqlite repositories when migrations are introduced. */
export const localStore:LocalStore={async get(key,fallback){try{const raw=await AsyncStorage.getItem(key);return raw?JSON.parse(raw) as typeof fallback:fallback}catch{return fallback}},async set(key,value){await AsyncStorage.setItem(key,JSON.stringify(value))}};
export const SQLITE_ADAPTER_NOTE='expo-sqlite is installed and isolated here for the native migration; AsyncStorage is the web/dev fallback.';
