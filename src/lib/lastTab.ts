// Remembers which (underwriting) tray tab the buyer was last on, so tapping
// the "Underwrite" toggle in TopBar returns them there instead of always
// landing on Reports. First-time (nothing stored yet) defaults to Submit —
// the leftmost tab, titled "Underwrite" in the tray (Ryan, 2026-08-09).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'underwriting_last_tab';

export type UnderwritingTab = 'submit' | 'reports' | 'listings' | 'buyers';
const VALID: UnderwritingTab[] = ['submit', 'reports', 'listings', 'buyers'];

export async function getLastUnderwritingTab(): Promise<UnderwritingTab> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return (VALID as string[]).includes(stored ?? '') ? (stored as UnderwritingTab) : 'submit';
  } catch {
    return 'submit';
  }
}

export function setLastUnderwritingTab(tab: UnderwritingTab): void {
  AsyncStorage.setItem(KEY, tab).catch(() => {});
}
