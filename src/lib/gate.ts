// The signed-out gate. The app is BROWSABLE without an account — deal list, deal
// detail, photos and the full underwriting report are all open — and only the
// ACTIONS ask for one. Every gated tap routes through requireAuth() so the prompt
// arrives at the moment the user reaches for the thing, never as a wall at launch.
//
// Why this pushes a REAL auth screen instead of a decorative sheet:
// Apple wants an account flow that actually works from wherever it is offered
// (5.1.1(v)), and a sheet that then has to push login makes creating an account a
// two-tap detour from an already-interrupted intent. Both auth screens read the
// `reason` param and show the matching copy, so they behave like the sheet would
// have without being a second surface to keep correct.

import { router } from 'expo-router';

export type GateReason =
  | 'save' | 'offer' | 'message' | 'alerts' | 'buybox' | 'report'
  | 'underwrite' | 'listings' | 'buyers' | 'account';

export const GATE_COPY: Record<GateReason, string> = {
  save:       'Create a free account to save deals to your favorites.',
  offer:      'Create a free account to make an offer on this deal.',
  message:    'Create a free account to message the seller.',
  alerts:     'Create a free account to be alerted the moment a matching deal lands.',
  buybox:     'Create a free account to set your buy-box and get matched deals.',
  report:     'Create a free account to report a listing to our team.',
  // NOT "create an account to run your own underwriting" — that framed the account
  // as the toll on a product we advertise as free. The account is the MAILBOX: a
  // report takes minutes and has to be delivered somewhere. The second sentence is
  // the one that matters, and it is only true because lib/draft.ts persists the
  // form before this push happens (Ryan, 2026-08-21).
  underwrite: 'Create a free account so we can send you your report. Your address and details are saved.',
  // listings/buyers used to reuse the `underwrite` string, so a user who tapped
  // Buyers was told to create an account "to run your own underwriting" — copy
  // about a different screen entirely.
  listings:   'Create a free account to publish your deals to the marketplace and track who is looking.',
  buyers:     'Create a free account to see which buyers are asking about your listings.',
  account:    'Create a free account to manage your profile, buy-box and alerts.',
};

// Reasons whose users are DEFINITIONALLY new: nobody arrives at the supply side
// of the app with an existing account they simply forgot to sign into — the whole
// funnel is "underwrite a deal you have never underwritten before". Sending them
// to Log in makes them find the "Create an account" link at the bottom first.
const SIGNUP_FIRST: readonly GateReason[] = ['underwrite', 'listings', 'buyers'];

/**
 * True when the reason belongs to the SUPPLY side (underwriting), as opposed to
 * the buyer/marketplace side. Signup uses this to decide whether the first-run
 * buy-box editor is relevant at all — see (auth)/signup.tsx.
 */
export function isSupplyReason(reason: string | undefined | null): boolean {
  return !!reason && (SIGNUP_FIRST as readonly string[]).includes(reason);
}

/** true = caller may proceed. Otherwise the prompt is presented. */
export function requireAuth(signedIn: boolean, reason: GateReason): boolean {
  if (signedIn) return true;
  if ((SIGNUP_FIRST as readonly GateReason[]).includes(reason)) {
    router.push({ pathname: '/(auth)/signup', params: { reason } });
  } else {
    router.push({ pathname: '/(auth)/login', params: { reason } });
  }
  return false;
}

/**
 * Same contract as requireAuth, but always lands on Create account.
 *
 * For a control whose LABEL says "Create a free account". Sending that tap to the
 * Log in screen is a bait-and-switch, and it was the live behaviour of two CTAs on
 * the marketplace screen. Both auth screens link to each other, so a returning user
 * who lands here is one tap from where they meant to be.
 */
export function promptSignUp(signedIn: boolean, reason: GateReason): boolean {
  if (signedIn) return true;
  router.push({ pathname: '/(auth)/signup', params: { reason } });
  return false;
}
