import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Field, Pill, ErrorText } from '@/components/ui';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { KeyboardLift } from '@/components/KeyboardLift';
import { useAuth } from '@/lib/auth';
import { useRuns } from '@/lib/runs';
import { submitUnderwriting, getSubjectSpecs, checkPropertyType } from '@/lib/api';
import type { SubmitUnderwritingBody } from '@/lib/types';
import { markHasRunUnderwrite } from '@/components/underwrite/returningUser';
import { clearDraft, loadDraft, saveDraft, type PoolChoice } from '@/lib/draft';
import { useCredits } from '@/components/underwrite/useCredits';
import { colors, space, font, radius } from '@/lib/theme';

// STATE B — the prefilled form, and the whole of the modal /underwriting/new route.
//
// A phone can't scrape RPR, so this always runs source 'mobile_app': served by an
// RPR agent or QUEUED until one is live (the user is told, and gets a push when it's
// ready). That is also why nothing on this screen promises a number of minutes at
// the moment of submit — see the footer.
//
// Two callers, one component:
//   • the Underwrite tab passes a CONTROLLED address (it owns the pitch/form switch
//     and the ✎ that goes back to the pitch);
//   • /underwriting/new passes nothing and gets its own address field, because a
//     modal opened from a push has no pitch behind it to return to.

function toIntOrNull(s: string): number | null {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}
function toFloatOrNull(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Pool is a TRI-state and 'unknown' is the only honest default. Public records carry
// no pool flag — RentCast's subject facts return null for it on essentially every
// address — so a pool answer can NEVER arrive by prefill. The old two-state control
// shipped with "No pool" pre-selected on a screen that otherwise displays real
// measurements, which made an untouched default indistinguishable from a submitter's
// answer: a pool house submitted as no-pool and the ARV came back low, with nothing
// in the report to point at. The type itself lives in lib/draft.ts because a draft
// has to be able to round-trip the difference.

const PROPERTY_TYPES = ['Single Family', 'Condo', 'Townhouse', 'Manufactured', 'Multi-Family', 'Land'];

export function SubmitUnderwritingForm({
  address: addressProp,
  onEditAddress,
  onSubmitted,
  restoreDraft = false,
}: {
  /** Controlled address (the Underwrite tab). Omit for the self-contained modal form. */
  address?: string;
  /** ✎ — return to the pitch. Only rendered when the address is controlled. */
  onEditAddress?: () => void;
  /** Receives the new analysis id so the caller can route to its progress screen. */
  onSubmitted?: (analysisId: string) => void;
  /**
   * Restore a saved draft on mount. TRUE only for the Underwrite tab.
   * /underwriting/new owns its own address field, so it would restore every
   * OTHER field of an abandoned draft over a blank address — a signed-in user
   * opening the modal would get a different property's sqft, beds and notes,
   * and the public-records lookup only fills BLANKS so the stale numbers would
   * survive all the way to submit.
   */
  restoreDraft?: boolean;
} = {}) {
  const router = useRouter();
  const { signedIn } = useAuth();
  const credits = useCredits();

  // The button says what is about to happen to THIS user. It used to always read
  // "Run my free underwrite" — wrong for a signed-in user spending a paid credit,
  // wrong for one with none left, and it hid the account step from a guest until
  // they tapped it. `credits === null` means unknown (guest, in flight, or a failed
  // read), and falls back to the neutral label rather than asserting a number.
  // "Submit for Underwriting" is the label wherever the tap actually submits, so it
  // matches the button on the pitch and the two read as review-then-submit. It only
  // changes where the ACTION changes: a guest gets an account step first, and a user
  // with nothing left cannot submit at all. The COUNT lives in the footer line rather
  // than the label — a button that grows to "Submit for Underwriting (2 free trial
  // reports left)" wraps on a phone and buries the verb. (Ryan, 2026-08-23.)
  const runLabel = (() => {
    if (!signedIn) return 'Create account & Submit';
    if (credits && credits.trialRemaining === 0 && credits.paidRemaining === 0) {
      return 'Add credits to submit';
    }
    return 'Submit for Underwriting';
  })();

  // What this tap will actually cost them. "Free trial" appears only while trial
  // credits remain and disappears the moment they are gone.
  const runFoot = (() => {
    if (!signedIn) return 'You’ll create a free account so we can send you the report.';
    if (!credits) return 'This starts your report.';
    if (credits.trialRemaining > 0) {
      return `This starts your report — 1 of your ${credits.trialRemaining} free trial report${credits.trialRemaining === 1 ? '' : 's'}.`;
    }
    if (credits.paidRemaining > 0) {
      return `This starts your report — 1 of your ${credits.paidRemaining} credit${credits.paidRemaining === 1 ? '' : 's'}.`;
    }
    return 'You’re out of report credits — add more to submit.';
  })();
  const { track } = useRuns();

  // Uncontrolled address (modal path only). When `addressProp` is supplied the parent
  // owns it and this stays empty.
  const [ownAddress, setOwnAddress] = useState('');
  const [ownSelected, setOwnSelected] = useState('');

  const [sqft, setSqft] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [year, setYear] = useState('');
  const [pool, setPool] = useState<PoolChoice>('unknown');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Provenance. Set by a HUMAN touching a control — never by the prefill. See the
  // payload comment at submit() for why the distinction is load-bearing.
  const [specsTouched, setSpecsTouched] = useState(false);

  // Property type + the manufactured-home warning (Ryan, 2026-08-14). 5021 S Parete Rd
  // ran as stick-built when the photos show a manufactured home, and RentCast, RPR and
  // the county assessor ALL coded it single family — so the only reliable catch is a
  // human who can see the type before running. Empty string = auto-detect.
  const [propType, setPropType] = useState('');
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [mfdMessage, setMfdMessage] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  // null = not looked up yet; false = looked up and public records had nothing.
  const [recordsFound, setRecordsFound] = useState<boolean | null>(null);

  // The account gate, at Run rather than at entry. The account is the MAILBOX the
  // report gets delivered to, not a toll on the door: asking before the address is
  // even typed is asking a stranger to pay for something they haven't seen work.
  const [needsAccount, setNeedsAccount] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const askedForAccount = useRef(false);

  const address = addressProp ?? ownAddress;
  // Only a SELECTED address triggers the public-records lookup. Keying the effect on
  // the raw address would fire a lookup per keystroke in the modal form.
  const lookupTarget = addressProp ?? ownSelected;

  // ── Public-records prefill ──────────────────────────────────────────────────
  // Fills only fields still blank, so a lookup can never overwrite a correction the
  // submitter deliberately typed. Notably it does NOT fill pool: see the Pool type.
  //
  // ⚠️ /api/underwriting/subject-specs requires a session and 401s for a GUEST, so a
  // signed-out submitter gets no prefill at all and always lands on the "we couldn't
  // pull public records" branch. That copy is still true from where they sit, so it
  // is the right thing to show — but the prefill half of this screen's promise does
  // not exist for guests until that endpoint accepts an unauthenticated read.
  // /api/underwriting/property-type-check does not exist on the server at all, so the
  // manufactured-home warning below is currently unreachable from the app.
  useEffect(() => {
    const a = lookupTarget.trim();
    if (a.length < 8) return;
    let alive = true;
    setLookingUp(true);
    Promise.all([
      getSubjectSpecs(a).catch(() => null),
      checkPropertyType(a).catch(() => null),
    ]).then(([specs, check]) => {
      if (!alive) return;
      if (specs) {
        if (specs.sqft != null) setSqft((v) => (v ? v : String(specs.sqft)));
        if (specs.bedrooms != null) setBeds((v) => (v ? v : String(specs.bedrooms)));
        if (specs.bathrooms != null) setBaths((v) => (v ? v : String(specs.bathrooms)));
        if (specs.year_built != null) setYear((v) => (v ? v : String(specs.year_built)));
        setDetectedType(specs.property_type ?? null);
        setRecordsFound(
          specs.sqft != null || specs.bedrooms != null || specs.bathrooms != null || specs.year_built != null,
        );
      } else {
        setRecordsFound(false);
      }
      setMfdMessage(check?.signal?.suspect ? check.signal.message : null);
      setLookingUp(false);
    });
    return () => { alive = false; };
  }, [lookupTarget]);

  // ── Restore the unsent draft ────────────────────────────────────────────────
  // Mount-only. The address half is restored by the SCREEN (it owns the pitch/form
  // switch, so it has to know before this component exists); this half is the specs.
  // Every field falls back to what is already in state rather than overwriting it,
  // because the public-records lookup can resolve first and a blank draft field must
  // not wipe a value the lookup just supplied.
  useEffect(() => {
    if (!restoreDraft) return;
    let alive = true;
    loadDraft().then((d) => {
      if (!alive || !d) return;
      setSqft((v) => d.sqft || v);
      setBeds((v) => d.beds || v);
      setBaths((v) => d.baths || v);
      setYear((v) => d.year || v);
      setPropType((v) => d.propType || v);
      setNotes((v) => d.notes || v);
      // Only a real answer is restored: a stored 'unknown' must not stamp over a
      // pick made in this session before the read landed.
      if (d.pool !== 'unknown') setPool(d.pool);
      // Carry the provenance across the signup detour, or a deliberate correction
      // comes back looking like a prefill and RPR overwrites it.
      if (d.specsTouched) setSpecsTouched(true);
    });
    return () => { alive = false; };
  }, [restoreDraft]);

  // Coming back from signup/login. The report is now deliverable, so say so — and
  // stop there. Auto-submitting on the auth transition would spend a free run the
  // user never deliberately started, and it would re-fire on any later refocus that
  // flips `signedIn` (a token refresh after a cold resume does exactly that).
  useEffect(() => {
    if (signedIn && askedForAccount.current) {
      askedForAccount.current = false;
      setNeedsAccount(false);
      setJustSignedIn(true);
    }
  }, [signedIn]);

  const editSpec = (set: (v: string) => void) => (v: string) => { setSpecsTouched(true); set(v); };

  const submit = async () => {
    // Drop the keyboard the moment they commit — it has nothing left to edit and it is
    // covering the screen they are about to be sent to.
    Keyboard.dismiss();
    const addr = address.trim();
    if (!addr) { setError('Property address is required.'); return; }

    if (!signedIn) {
      // Gate here, not at entry. The old entry wall existed because a 401 at POST
      // would have thrown the whole form away — but that is a DATA-LOSS argument,
      // and the answer to data loss is a draft, not an earlier wall. Written before
      // the prompt is even shown, so it survives the layout backstop replacing this
      // screen, an email-confirmation round trip, or the app being killed in the
      // background mid-signup. `void` on purpose: navigation must not wait on it.
      void saveDraft({ address: addr, sqft, beds, baths, year, pool, propType, notes, specsTouched });
      askedForAccount.current = true;
      setNeedsAccount(true);
      setError(null);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // ⚠️ `specs_operator_verified` is a BUNDLE flag covering beds/baths/sqft/pool,
      // not a pool flag. On the engine it does three things: it stops RPR's county
      // record from correcting a wrong submitted sqft/beds/baths, it stops the
      // notes-regex seller overrides, and it stops the sqft plausibility estimate.
      // So it must mean "a human looked at this panel", and the ONLY evidence of that
      // is a human touching one of its controls — never the prefill, which is exactly
      // how the extension's version of this ends up permanently true.
      //
      // NOT set by a pool tap. `pool !== 'unknown'` used to be OR'd in here, which meant
      // one tap on "No pool" locked sqft/beds/baths against RPR's county correction —
      // reopening the 478 Vista Lake bug (500 sqft submitted on a 1,757 sqft home, fixed
      // precisely BY that correction) for a user who never looked at those numbers.
      // Pool no longer needs to ride this flag: has_pool is nullable as of migration 213
      // and the submit route stopped coalescing it, so "Not sure" persists as NULL and is
      // genuinely distinct from an asserted false on its own.
      const specsVerified = specsTouched;
      const body: SubmitUnderwritingBody & { specs_operator_verified?: boolean } = {
        property_address: addr,
        property_sqft: toIntOrNull(sqft),
        bedrooms: toIntOrNull(beds),
        bathrooms: toFloatOrNull(baths),
        year_built: toIntOrNull(year),
        // Omitted entirely while 'Not sure' — we assert nothing we were not told.
        ...(pool === 'unknown' ? {} : { has_pool: pool === 'yes' }),
        ...(specsVerified ? { specs_operator_verified: true } : {}),
        // Null when blank so the pipeline still auto-detects, as before. When the
        // submitter DID pick one, lock it so the engine's RPR/tiny-lot correction
        // can't revert it mid-run (migration 198).
        raw_property_type: propType || null,
        property_type_locked: !!propType,
        salesperson_comments: notes.trim() || null,
      };
      const res = await submitUnderwriting(body);
      // Register the run and stay put. The banner above the navigator is what carries
      // it from here; the old code either popped an Alert and went back (queued —
      // after which the run was completely invisible in the app) or replaced onto the
      // report screen, which destroyed the back entry and TRAPPED the user on a
      // progress page with nothing else to do. (Ryan, 2026-08-19.)
      track({
        id: res.analysis_id,
        access_token: res.access_token,
        address: addr,
        status: res.queued ? 'queued' : res.status,
      });
      markHasRunUnderwrite();
      // Only once the run is REGISTERED. Clearing any earlier would lose the form on
      // a failed submit, and leaving it behind would repopulate the screen with the
      // property they just sent — which reads as "the submit didn't take".
      void clearDraft();
      setSqft(''); setBeds(''); setBaths(''); setYear('');
      setPool('unknown'); setNotes(''); setPropType(''); setDetectedType(null); setMfdMessage(null);
      setSpecsTouched(false); setRecordsFound(null); setJustSignedIn(false);
      setOwnAddress(''); setOwnSelected('');
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 8000);
      // Navigation is the CALLER's decision: the modal route dismisses itself, the
      // Underwrite tab drops back to its pitch. Doing either here would race.
      onSubmitted?.(res.analysis_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // The facts line, built from what is actually in the boxes — so it stays truthful
  // after a correction instead of continuing to recite the record.
  const factSqft = toIntOrNull(sqft);
  const factBits = [
    beds ? `${beds} bed` : null,
    baths ? `${baths} bath` : null,
    factSqft != null ? `${factSqft.toLocaleString()} sqft` : null,
    year ? `built ${year}` : null,
  ].filter((s): s is string => s !== null);

  return (
    <KeyboardLift style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {addressProp === undefined ? (
          <AddressAutocomplete
            label="Property address *"
            value={ownAddress}
            onChangeText={setOwnAddress}
            onSelect={(a) => { setOwnAddress(a); setOwnSelected(a); }}
            placeholder="Start typing an address…"
          />
        ) : (
          // The chip IS the undo. Tapping ✎ restores the pitch with the field back,
          // which is the only way out of State B — so it has to look tappable.
          <Pressable
            onPress={onEditAddress}
            disabled={!onEditAddress}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Change address. Currently ${address}`}
          >
            <Text style={styles.chipText} numberOfLines={2}>{address}</Text>
            {onEditAddress ? <Text style={styles.chipEdit}>✎</Text> : null}
          </Pressable>
        )}

        {lookingUp ? <Text style={styles.lookup}>Looking up public records…</Text> : null}

        {recordsFound === false ? (
          <>
            <Text style={styles.missTitle}>Tell us about the property</Text>
            <Text style={styles.help}>
              We couldn’t pull public records for this one. Fill in what you know - all of it is optional.
            </Text>
          </>
        ) : factBits.length > 0 ? (
          <>
            <Text style={styles.facts}>{factBits.join(' · ')}</Text>
            <Text style={styles.help}>
              From public records. Correct anything that’s wrong - we re-check everything during the run.
            </Text>
          </>
        ) : null}

        {/* ⚠️ The placeholders are '—', not example numbers. They used to read
            1,757 / 2018 / 3 / 2, which are the specs of a real house in the test
            data — and on a screen that promises prefill, four grey plausible
            numbers read as fetched values. Submitters left them alone and the run
            went out against someone else's house. A dash cannot be mistaken for
            a measurement. */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Field label="Sqft" value={sqft} onChangeText={editSpec(setSqft)} placeholder="—" keyboardType="number-pad" />
          </View>
          <View style={styles.half}>
            <Field label="Year built" value={year} onChangeText={editSpec(setYear)} placeholder="—" keyboardType="number-pad" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Field label="Beds" value={beds} onChangeText={editSpec(setBeds)} placeholder="—" keyboardType="number-pad" />
          </View>
          <View style={styles.half}>
            <Field label="Baths" value={baths} onChangeText={editSpec(setBaths)} placeholder="—" keyboardType="decimal-pad" />
          </View>
        </View>

        <Text style={styles.label}>Pool</Text>
        <View style={styles.pills}>
          <Pill label="Not sure" active={pool === 'unknown'} onPress={() => setPool('unknown')} />
          <Pill label="No pool" active={pool === 'no'} onPress={() => setPool('no')} />
          <Pill label="Has pool" active={pool === 'yes'} onPress={() => setPool('yes')} />
        </View>
        <Text style={styles.hint}>
          Public records don’t carry pool. Tell us if you know - it moves the ARV.
        </Text>

        <Text style={styles.label}>
          Property type{detectedType ? ` — records say ${detectedType}` : ''}
        </Text>
        <View style={styles.pills}>
          <Pill label="Auto" active={propType === ''} onPress={() => setPropType('')} />
          {PROPERTY_TYPES.map((t) => (
            <Pill key={t} label={t} active={propType === t} onPress={() => setPropType(t)} />
          ))}
        </View>
        {mfdMessage ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>⚠ {mfdMessage}</Text>
          </View>
        ) : null}

        <Field
          label="Condition & context (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Needed repairs, recent updates, occupancy (vacant / tenant / owner), roof & systems age - anything that affects value."
          multiline
          numberOfLines={4}
          style={styles.notes}
        />
        <Text style={styles.hint}>This is what moves the rehab number most.</Text>
      </ScrollView>

      {/* Pinned CTA. It used to be the last thing in the scroll, which meant the
          submitter had to scroll past every field to reach it AND the keyboard sat
          on top of it while the notes field was focused (Ryan, 2026-08-18, on
          device). Outside the ScrollView but inside the KeyboardLift it is always
          reachable and rides above the keyboard. The error lives here too so a
          failed submit can't scroll off-screen. */}
      <View style={styles.footer}>
        {error ? <ErrorText>{error}</ErrorText> : null}

        {needsAccount ? (
          <View style={styles.account}>
            <Text style={styles.accountText}>
              Create a free account so we can send you your report. Your address and details are saved.
            </Text>
            <Button
              title="Create free account"
              variant="accent"
              onPress={() => router.push({ pathname: '/(auth)/signup', params: { reason: 'underwrite' } })}
            />
            <Button
              title="Log in"
              variant="outline"
              onPress={() => router.push({ pathname: '/(auth)/login', params: { reason: 'underwrite' } })}
            />
          </View>
        ) : (
          <Button title={runLabel} onPress={submit} loading={busy} />
        )}

        {/* No minute promise at the moment of truth. "3-5 minutes" stays in the PITCH
            because it is already the public claim on the website, but a brand-new
            install has no RPR browser, so this run may be served by a central agent
            or sit in a QUEUE — and a countdown started here would be a lie roughly as
            often as it was true. (Ryan.) */}
        <Text style={styles.foot}>
          {justSubmitted
            ? 'We’ll notify you the moment it’s done.'
            : justSignedIn
              ? 'You’re in. Tap Submit to start your report.'
              : runFoot}
        </Text>
      </View>
    </KeyboardLift>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.lg },
  help: { color: colors.textDim, fontSize: font.small, lineHeight: 20, marginBottom: space.lg },
  hint: { color: colors.textFaint, fontSize: font.small, lineHeight: 18, marginTop: -space.xs, marginBottom: space.lg },
  facts: { color: colors.text, fontSize: font.body, fontWeight: '600', marginBottom: space.xs },
  missTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  label: { color: colors.textDim, fontSize: font.small, fontWeight: '600', marginBottom: space.sm },
  pills: { flexDirection: 'row', gap: space.sm, marginBottom: space.md, flexWrap: 'wrap' },
  lookup: { color: colors.textFaint, fontSize: font.small, marginTop: -space.sm, marginBottom: space.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: space.md, paddingVertical: 12, marginBottom: space.md,
  },
  chipPressed: { backgroundColor: colors.surface },
  chipText: { color: colors.text, fontSize: font.body, fontWeight: '600', flex: 1 },
  chipEdit: { color: colors.blue, fontSize: font.h3 },
  warn: { borderWidth: 1, borderColor: '#B45309', backgroundColor: '#78350F33', borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  warnText: { color: '#FCD34D', fontSize: font.small, lineHeight: 19 },
  notes: { minHeight: 96, textAlignVertical: 'top', paddingTop: 10, borderRadius: radius.md },
  account: { gap: space.md, marginBottom: space.sm },
  accountText: { color: colors.text, fontSize: font.small, lineHeight: 20 },
  foot: { color: colors.textFaint, fontSize: font.small, textAlign: 'center', marginTop: space.sm },
  footer: {
    padding: space.lg, paddingTop: space.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
});
