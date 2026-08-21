// The unsent underwrite draft.
//
// This file is the entire justification for moving the account wall off the ENTRY
// of the submit form and onto the Run button. The old entry gate had a real
// argument behind it — "the form is long and every field would be thrown away when
// the POST 401s" — but that objection is about DATA LOSS, and the remedy for data
// loss is a draft, not an earlier wall. So: the form writes here unconditionally
// before signup is pushed, and reads it back when the user returns.
//
// AsyncStorage, not lib/secureStore.ts: this is a street address and a few optional
// specs — the same class of local preference as lib/lastTab.ts and
// lib/onboarding.ts. The encrypted store exists for the Supabase session blob and
// costs a keychain round-trip per read.
//
// Deliberately NOT scoped to a user id. It is written while there is no user, which
// is the whole point of it.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'underwrite_draft_v1';

// A draft is a hand-off across a signup round trip (which can include an email
// confirmation, so minutes, not seconds), not a saved property. Past a day it is
// far more likely to be a stale address the user has forgotten about than the one
// they are standing in front of, and silently repopulating THAT is worse than an
// empty form.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Tri-state, matching the approved copy: public records do not carry pool, so
// "Not sure" is a real answer and the DEFAULT — distinct from an asserted "No
// pool", which moves the ARV. A boolean cannot express that difference.
export type PoolChoice = 'unknown' | 'no' | 'yes';

// Every field is a STRING because that is what the form's TextInputs hold. Parsing
// to numbers here and formatting back on restore would round-trip "1,757" into
// "1757" and a half-typed "19" into something the user did not write.
export type DraftFields = {
  address: string;
  sqft: string;
  beds: string;
  baths: string;
  year: string;
  pool: PoolChoice;
  /** '' = auto-detect, matching the form's "Auto" pill. */
  propType: string;
  notes: string;
  /**
   * Whether a human actually EDITED a spec box before the draft was saved.
   * Without this a guest who hand-corrected sqft, then signed up, comes back with
   * specsTouched=false — so their deliberate correction is submitted WITHOUT
   * specs_operator_verified and RPR overwrites it. That is the same provenance
   * loss the flag exists to prevent, just inverted.
   */
  specsTouched: boolean;
};

export type UnderwriteDraft = DraftFields & { savedAt: number };

const EMPTY: DraftFields = {
  address: '', sqft: '', beds: '', baths: '', year: '', pool: 'unknown', propType: '', notes: '',
  specsTouched: false,
};

function isBlank(d: DraftFields): boolean {
  return !d.address.trim() && !d.sqft.trim() && !d.beds.trim() && !d.baths.trim()
    && !d.year.trim() && !d.notes.trim() && !d.propType && d.pool === 'unknown';
}

/**
 * Persist the draft. Never rejects, so a caller can `void saveDraft(...)` on the
 * way into signup without a try/catch and without blocking the navigation.
 *
 * A completely blank draft CLEARS instead of writing: otherwise clearing the form
 * and walking away would leave a husk behind, and the "You're in. Tap Run to start
 * your report." message would greet the user over nothing.
 */
export function saveDraft(fields: DraftFields): Promise<void> {
  if (isBlank(fields)) return clearDraft();
  const draft: UnderwriteDraft = { ...fields, savedAt: Date.now() };
  return AsyncStorage.setItem(KEY, JSON.stringify(draft)).catch(() => {});
}

/**
 * The draft, or null when there isn't one / it is too old / it did not survive a
 * schema change. Restoring is a convenience: every failure path here must be a
 * clean empty form, never a crash and never a half-populated one.
 */
export async function loadDraft(): Promise<UnderwriteDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const o = parsed as Record<string, unknown>;
    const savedAt = typeof o.savedAt === 'number' ? o.savedAt : 0;
    // `Date.now() - savedAt < 0` covers a clock that moved backwards — treat a
    // draft from "the future" as usable rather than discarding real work.
    if (savedAt <= 0 || Date.now() - savedAt > MAX_AGE_MS) {
      void clearDraft();
      return null;
    }

    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const pool: PoolChoice =
      o.pool === 'yes' || o.pool === 'no' || o.pool === 'unknown' ? o.pool : 'unknown';

    const fields: DraftFields = {
      ...EMPTY,
      address: str(o.address),
      sqft: str(o.sqft),
      beds: str(o.beds),
      baths: str(o.baths),
      year: str(o.year),
      pool,
      propType: str(o.propType),
      notes: str(o.notes),
    };
    if (isBlank(fields)) return null;
    return { ...fields, savedAt };
  } catch {
    return null;
  }
}

/**
 * Drop the draft. Call it once the run has actually been accepted — leaving it
 * behind would repopulate the form with the property the user just submitted the
 * next time they open the screen, which reads as "the submit didn't take".
 */
export function clearDraft(): Promise<void> {
  return AsyncStorage.removeItem(KEY).catch(() => {});
}
