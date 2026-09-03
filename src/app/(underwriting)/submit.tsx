import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { KeyboardLift } from '@/components/KeyboardLift';
import { SubmitUnderwritingForm } from '@/components/SubmitUnderwritingForm';
import { Loading } from '@/components/ui';
import { Pitch } from '@/components/underwrite/Pitch';
import { useUnderwritePricing } from '@/components/underwrite/marketingConfig';
import { useAuth } from '@/lib/auth';
import { loadDraft } from '@/lib/draft';
import { colors, font, space } from '@/lib/theme';

// The Underwrite tab — ONE screen with two faces.
//
//   STATE A  the pitch. EVERYONE with no address chosen yet — guest or signed in.
//            Hero, address field, sample report, how it works, why the number holds
//            up, pricing, legal.
//   STATE B  the form. The pitch unmounts and the prefilled form takes the screen.
//
// ⚠️ There used to be a STATE C: a returning signed-in user skipped the pitch and
// landed straight on the form. Ryan removed it 2026-09-03 — signing in should not
// cost you the page that explains the product; the ONLY difference once you are
// signed in is that the free-trial copy drops out (see Pitch's `signedIn` prop).
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
  const router = useRouter();
  const { signedIn } = useAuth();
  const pricing = useUnderwritePricing();

  // `draft` is what is typed in the pitch's field; `address` is what was SELECTED
  // from the dropdown. Only the second one moves the screen to State B.
  const [draft, setDraft] = useState('');
  const [address, setAddress] = useState('');

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

  // The pitch is now shown to EVERYONE until an address is chosen (Ryan,
  // 2026-09-03) — being signed in no longer skips it.
  //
  // Only the draft still has to land before we can pick a face; the
  // returning-user flag no longer decides anything here, so a signed-in user no
  // longer waits on it and the brief Loading flash it caused is gone. Painting
  // the pitch and then yanking it away when the draft resolves is the exact
  // disorienting swap the onSelect trigger exists to avoid, so hold instead.
  const deciding = !resumed;
  const showPitch = !address && !deciding;

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
            <Pitch
              pricing={pricing}
              signedIn={signedIn}
              canStart={draft.trim().length >= 8 && draft.trim() !== address}
              onStart={() => setAddress(draft.trim())}
            >
              <AddressAutocomplete
                value={draft}
                onChangeText={setDraft}
                onSelect={(a) => { setDraft(a); setAddress(a); }}
                placeholder="Start typing an address…"
              />
              {/* ⚠️ The button above IS the escape hatch, and it is load-bearing.
                  /api/places/autocomplete gates on a logged-in user and 401s a guest,
                  so the dropdown never opens and onSelect — which used to be the only
                  trigger — never fires. Without a commit control the pitch is a dead
                  end for exactly the audience it exists for. It stays even once Places
                  is opened up, for the address Google simply does not have. Still a
                  deliberate COMMIT (>= 8 chars, changed since last) rather than a
                  keystroke trigger. */}
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
          // Go to the progress screen rather than leaving the submitter sitting on
          // the form they just sent (Ryan, 2026-08-28). A `push`, never `replace`:
          // an earlier version replaced onto a progress page and TRAPPED the user
          // there with no back entry and nothing else to do. Push keeps the back
          // gesture, and the progress screen now offers its own two ways out.
          onSubmitted={(analysisId) => {
            setAddress(''); setDraft('');
            router.push({ pathname: '/underwriting/progress/[id]', params: { id: analysisId } });
          }}
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
