// "Has this person already run a report from this install?"
//
// State C — a returning user goes straight to the form and never sees the pitch
// again. The pitch is a sales page; showing it to someone who has already bought
// puts four screens of persuasion between them and the address box they opened the
// app to use.
//
// Deliberately a LOCAL flag rather than a listUnderwritings() call: this decides a
// first-paint layout, and gating the app's most important screen on a network round
// trip would either flash the pitch and then rip it away, or hold a spinner over the
// address box. A cold reinstall showing the pitch once more is the harmless failure.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'has_run_underwrite';

/** Written after a submit actually registers a run. */
export function markHasRunUnderwrite(): void {
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}

/**
 * null while unknown (the read is async and the very first frame has no answer).
 * Callers must treat null as "not yet decided" and not flash the pitch — see
 * submit.tsx, which holds the pitch back until this resolves.
 */
export function useHasRunUnderwrite(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((v) => { if (alive) setSeen(v === '1'); })
      .catch(() => { if (alive) setSeen(false); });
    return () => { alive = false; };
  }, []);

  return seen;
}
