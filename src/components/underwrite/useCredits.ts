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
 *
 * ⚠️ `hideTrial` goes further: on the Underwrite pitch, a SIGNED-IN user sees no
 * free-trial information at all (Ryan, 2026-09-03), so the remaining balance is
 * still shown but is no longer framed as a trial. The count is account
 * information they need; the word "trial" is marketing they have already
 * converted on.
 */
export function creditsLine(credits: UwCredits | null, freeReports: number | null, hideTrial = false): string {
  if (credits) {
    const { trialRemaining, paidRemaining } = credits;
    if (trialRemaining > 0) {
      const n = `${trialRemaining} report${trialRemaining === 1 ? '' : 's'} left.`;
      return hideTrial ? n : `Free trial: ${n}`;
    }
    // Trial spent — no mention of it from here on.
    if (paidRemaining > 0) {
      return `${paidRemaining} report credit${paidRemaining === 1 ? '' : 's'} left.`;
    }
    return 'No report credits left — add more to run another.';
  }
  // ⚠️ No credits yet — this is the FIRST PAINT, before the fetch lands. For a
  // signed-in user that made this the one place trial copy still leaked through:
  // it is reached on every cold open of the pitch, for a moment, on the exact
  // screen Ryan asked to have trial information removed from. Say nothing rather
  // than advertising a trial to someone who already has an account.
  if (hideTrial) return '';
  return freeReports == null
    ? 'Your free trial is on us — no card.'
    : `Your free trial includes ${freeReports} reports — no card.`;
}
