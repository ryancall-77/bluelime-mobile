// LargeSecureStore — the Supabase-recommended RN storage adapter for auth
// sessions. Supabase session blobs can exceed expo-secure-store's 2KB limit, so
// we encrypt the value with AES and keep only the (small) encryption key in the
// iOS keychain / Android keystore; the ciphertext lives in AsyncStorage.
//
// Ref: Supabase "React Native / Expo" auth guide (LargeSecureStore pattern).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import aesjs from 'aes-js';

// SecureStore keys are restricted to alphanumerics, ".", "-" and "_".
function keyName(name: string): string {
  return `blueaes_${name}`.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function encrypt(name: string, value: string): Promise<string> {
  const keyBytes = Crypto.getRandomBytes(256 / 8);
  const cipher = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(1));
  const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(keyName(name), aesjs.utils.hex.fromBytes(keyBytes));
  return aesjs.utils.hex.fromBytes(encryptedBytes);
}

async function decrypt(name: string, value: string): Promise<string | null> {
  const keyHex = await SecureStore.getItemAsync(keyName(name));
  if (!keyHex) return null;
  const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
  const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

// ── SSR / build-time guard ──────────────────────────────────────────────────
// `expo export` prerenders the router's routes in NODE to produce the web build,
// and `eas update` exports platform=all by default. Supabase constructs its client
// at module scope with persistSession, so _initialize() -> __loadSession() ->
// storage.getItem() runs during that render — and AsyncStorage's web backend
// reaches for window.localStorage, which does not exist in Node. The result was
// `ReferenceError: window is not defined`, an export exit code 7, and a FAILED
// `eas update` that looked like a bundler problem rather than an auth-storage one.
//
// A build-time render has no session to restore and nowhere to put one, so the
// correct behaviour is a no-op, not a polyfill. React Native defines `window`
// (global.window = global), so this is false on device and the real adapter runs.
const NO_DOM = typeof window === 'undefined';

export const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    if (NO_DOM) return null;
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      return await decrypt(key, encrypted);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (NO_DOM) return;
    const encrypted = await encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  },
  async removeItem(key: string): Promise<void> {
    if (NO_DOM) return;
    await SecureStore.deleteItemAsync(keyName(key)).catch(() => {});
    await AsyncStorage.removeItem(key);
  },
};
