// First-run onboarding flag.
//
// The deal feed is buy-box-driven: with no buy-box there is nothing to match, so
// a brand-new account lands on an empty map and has to discover the gear icon by
// itself. That's backwards — the one step that makes the app work was optional
// and hidden (Ryan, 2026-08-12). Signup now sets this flag and the Search screen
// consumes it once, opening the buy-box editor over the map.
//
// Consume-once on purpose: it must never re-prompt a user who deliberately
// skipped it, and it is cleared even if the read succeeds but the push fails.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'needs_buybox_setup';

/** Called right after a successful signup. */
export function markNeedsBuyBox(): void {
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}

/** True exactly once per signup; clears itself. */
export async function consumeNeedsBuyBox(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (!v) return false;
    await AsyncStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
