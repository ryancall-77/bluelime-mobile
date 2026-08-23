// The signed-in user's remaining reports, for the copy on the Underwrite screen.
//
// Deliberately returns THREE states, not two: `null` means "we don't know yet" and is
// NOT the same as zero. A guest, a request in flight and a failed read all resolve to
// null, and every caller falls back to the generic pitch copy rather than to "0 reports
// remaining" — telling someone who just bought credits that they have none is a worse
// failure than showing them the marketing line for another second.
import { useEffect, useState } from 'react';
import { getUwCredits, type UwCredits } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function useCredits(): UwCredits | null {
  const { signedIn } = useAuth();
  const [credits, setCredits] = useState<UwCredits | null>(null);

  useEffect(() => {
    if (!signedIn) { setCredits(null); return; }
    let alive = true;
    getUwCredits()
      .then((c) => { if (alive) setCredits(c); })
      .catch(() => { if (alive) setCredits(null); });
    return () => { alive = false; };
  }, [signedIn]);

  return credits;
}

/**
 * The one place the "how many reports do you have" sentence is written.
 *
 * "Free trial" appears ONLY while trial credits remain. The moment they are spent it
 * disappears entirely — a paying user reading 'free trial' next to credits they bought
 * is confusing at best and reads as a billing error at worst. (Ryan, 2026-08-23.)
 */
export function creditsLine(credits: UwCredits | null, freeReports: number | null): string {
  if (credits) {
    const { trialRemaining, paidRemaining } = credits;
    if (trialRemaining > 0) {
      return `Free trial: ${trialRemaining} report${trialRemaining === 1 ? '' : 's'} left.`;
    }
    // Trial spent — no mention of it from here on.
    if (paidRemaining > 0) {
      return `${paidRemaining} report credit${paidRemaining === 1 ? '' : 's'} left.`;
    }
    return 'No report credits left — add more to run another.';
  }
  return freeReports == null
    ? 'Your free trial is on us — no card.'
    : `Your free trial includes ${freeReports} reports — no card.`;
}
