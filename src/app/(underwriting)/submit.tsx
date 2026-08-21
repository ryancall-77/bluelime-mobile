import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { KeyboardLift } from '@/components/KeyboardLift';
import { SubmitUnderwritingForm } from '@/components/SubmitUnderwritingForm';
import { Loading } from '@/components/ui';
import { Pitch } from '@/components/underwrite/Pitch';
import { useUnderwritePricing } from '@/components/underwrite/marketingConfig';
import { useHasRunUnderwrite } from '@/components/underwrite/returningUser';
import { useAuth } from '@/lib/auth';
import { loadDraft } from '@/lib/draft';
import { colors, font, space } from '@/lib/theme';

// The Underwrite tab — ONE screen with two faces.
//
//   STATE A  the pitch. A guest, or a signed-in account that has never run anything,
//            with no address chosen yet. Hero, address field, sample report, how it
//            works, why the number holds up, pricing, legal.
//   STATE B  the form. The pitch unmounts and the prefilled form takes the screen.
//   STATE C  a returning signed-in user skips A entirely and lands on the form.
//
// ── Why the switch is onSelect and NOT the first keystroke ──────────────────────
// A keystroke trigger tears the pitch — and the sample card someone may be reaching
// for — off the screen on character one, while the autocomplete dropdown opens over
// the space it just vacated. That is a disorienting half second on the app's single
// most important screen, and it fires on a mistyped character too. Committing to an
// ADDRESS is the real signal of intent, so the dropdown's onSelect is the trigger.
//
// Tapping ✎ on the address chip clears the choice and restores the pitch with the
// field still holding what was picked. That is the undo, and it is the only one
// needed: nothing has been spent at this point.
//
// This screen is deliberately NOT gated at entry any more. The account is the
// mailbox the report is delivered to, not a toll on the door — the prompt lives at
// Run, inside the form. See SubmitUnderwritingForm.
export default function Submit() {
  const { signedIn } = useAuth();
  const pricing = useUnderwritePricing();
  const hasRun = useHasRunUnderwrite();

  // `draft` is what is typed in the pitch's field; `address` is what was SELECTED
  // from the dropdown. Only the second one moves the screen to State B.
  const [draft, setDraft] = useState('');
  const [address, setAddress] = useState('');
  // A submit inside this session counts as "returning" immediately — useHasRunUnderwrite
  // reads AsyncStorage once on mount, so without this the pitch would slide back over
  // the confirmation line the moment the run registered.
  const [submittedOnce, setSubmittedOnce] = useState(false);

  // ── Resume an unsent draft ──────────────────────────────────────────────────
  // A guest who tapped Run, went through signup and came back does NOT return to a
  // live component: the root layout's backstop can replace this screen while there
  // is no session, and an email confirmation can take the app out of memory
  // entirely. The address is what decides which FACE this screen wears, so it has
  // to be restored here rather than inside the form — restoring it lands the user
  // straight back on State B, holding the property they were working on.
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadDraft().then((d) => {
      if (!alive) return;
      // Restore into State B ONLY for a signed-in user — i.e. someone who just came
      // back through signup, which is the case this draft exists to serve.
      //
      // A GUEST must keep seeing the pitch. Otherwise the failure mode is: they type
      // an address, hit Run, meet the account prompt, walk away — and because the
      // draft only clears on a successful submit or after 24h, their next cold launch
      // drops them straight into a bare form and they never see the pitch again for a
      // day. That is the app's whole first impression, withheld from precisely the
      // audience that has not converted yet. The draft still restores their FIELDS the
      // moment they pick an address again; it just no longer decides the face.
      if (d?.address && signedIn) { setDraft(d.address); setAddress(d.address); }
      setResumed(true);
    });
    return () => { alive = false; };
  }, [signedIn]);

  const skipPitch = signedIn && (hasRun === true || submittedOnce);
  // Two things have to land before we know which face to wear, and both are cheap
  // local reads: the returning-user flag (only a signed-in user can be a returning
  // runner, so a guest never waits on it) and the unsent draft. Painting the pitch
  // first and then yanking it away when either resolves is the exact disorienting
  // swap the onSelect trigger exists to avoid, so hold instead.
  const deciding = (signedIn && hasRun === null && !submittedOnce) || !resumed;
  const showPitch = !address && !skipPitch && !deciding;

  return (
    <>
      {deciding ? <Loading /> : null}

      {showPitch ? (
        <KeyboardLift style={styles.flex}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Pitch pricing={pricing}>
              <AddressAutocomplete
                value={draft}
                onChangeText={setDraft}
                onSelect={(a) => { setDraft(a); setAddress(a); }}
                placeholder="Start typing an address…"
              />
              {/* ⚠️ ESCAPE HATCH — without this, a GUEST can never reach State B.
                  /api/places/autocomplete gates on a logged-in user and 401s for a
                  signed-out caller, so the dropdown never opens and onSelect — the
                  only trigger — never fires. The pitch would be a dead end for
                  exactly the audience it exists for. This is also the right
                  behaviour whenever Places is down or the address simply isn't in
                  Google's index, so it stays even after the endpoint is opened up.
                  It is still a deliberate COMMIT, not a keystroke trigger. */}
              {draft.trim().length >= 8 && draft.trim() !== address ? (
                <Pressable
                  onPress={() => setAddress(draft.trim())}
                  style={({ pressed }) => [styles.useAddress, pressed && styles.useAddressPressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.useAddressText}>Use this address →</Text>
                </Pressable>
              ) : null}
            </Pitch>
          </ScrollView>
        </KeyboardLift>
      ) : null}

      {!showPitch && !deciding ? (
        <SubmitUnderwritingForm
          restoreDraft
          // No address chosen (State C, or straight after a submit) → the form falls
          // back to owning its own address field, which is the same shape the modal
          // /underwriting/new route already uses.
          {...(address ? { address, onEditAddress: () => setAddress('') } : {})}
          onSubmitted={() => { setSubmittedOnce(true); setAddress(''); setDraft(''); }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  useAddress: { alignSelf: 'flex-start', paddingVertical: space.xs, marginTop: -space.sm },
  useAddressPressed: { opacity: 0.6 },
  useAddressText: { color: colors.blue, fontSize: font.small, fontWeight: '700' },
});
