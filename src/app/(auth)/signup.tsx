import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Screen, Button, Field, ErrorText } from '@/components/ui';
import { KeyboardLift } from '@/components/KeyboardLift';
import { useAuth } from '@/lib/auth';
import { colors, font, radius, space } from '@/lib/theme';
import { TERMS_URL, PRIVACY_URL } from '@/lib/config';
import { markNeedsBuyBox } from '@/lib/onboarding';
import { GATE_COPY, isSupplyReason, type GateReason } from '@/lib/gate';

// Signup includes the Apple-required EULA / terms gate for UGC apps: the buyer
// must affirmatively agree before an account can be created.
export default function Signup() {
  const { signUp, configured } = useAuth();
  const router = useRouter();
  // Present when a gated tap sent the user here. It selects the headline copy and
  // decides whether the buy-box prompt is queued — it no longer decides whether an
  // exit exists (see `close` below).
  const { reason } = useLocalSearchParams<{ reason?: GateReason }>();
  const gateCopy = reason ? GATE_COPY[reason] : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  // Always present, for the same reason it is on the login screen: a guest must
  // never be able to reach an auth screen they cannot back out of. Browsing is
  // public, so there is always somewhere to return to. canGoBack() is read in the
  // handler, not during render (the react compiler is on).
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(marketplace)');
  };

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) { setError('Enter an email and password.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (!agreed) { setError('You must agree to the Terms and EULA to continue.'); return; }
    setBusy(true);
    try {
      const { needsConfirm } = await signUp(email, password);
      // Queue the buy-box prompt for whenever they actually land in the app —
      // set BEFORE the confirm branch so it survives the email-confirmation
      // round trip (sign up → confirm in email → come back → log in).
      //
      // Buyer-side signups ONLY. A buy-box is markets + price band + min profit —
      // it is what the marketplace feed matches against, and it means nothing to
      // someone who signed up from the UNDERWRITE side to get a report emailed to
      // them. Unconditional, this dropped that user into a buyer's buy-box form
      // over the marketplace map the first time they opened Deals. A signup with
      // no reason at all is an organic marketplace signup, so it still queues.
      if (!isSupplyReason(reason)) markNeedsBuyBox();
      // Email confirmation off → there is a session already. The root gate no
      // longer moves a signed-in user off (auth) (that half is gone now that the
      // group is public), so navigate back to whatever the user was browsing.
      if (needsConfirm) {
        setConfirmSent(true);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(marketplace)');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <Screen>
        <View style={styles.confirm}>
          <Text style={styles.brand}>Check your email</Text>
          <Text style={styles.tagline}>
            We sent a confirmation link to {email}. Tap it to finish setting up your account,
            then come back and log in.
          </Text>
          {/* This used to replace() onto /(auth)/login, which was a dead end: with
              nothing under it the user could neither get back to the app nor do
              anything until the email arrived. Browsing is open now, so the primary
              action is "go look at deals while you wait". */}
          <Button
            title="Keep browsing deals"
            variant="accent"
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(marketplace)'); }}
            style={{ marginTop: space.xl }}
          />
          <Button
            title="Log in"
            variant="outline"
            onPress={() => router.replace({ pathname: '/(auth)/login', params: reason ? { reason } : {} })}
            style={{ marginTop: space.md }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardLift>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={close} hitSlop={8} style={styles.closeRow} accessibilityRole="button">
            <Text style={styles.closeText}>✕  Close</Text>
          </Pressable>

          <Text style={styles.brand}>Create your account</Text>
          {/* The tagline used to promise "Free early access — browse verified deals
              and get alerts." Browsing is no longer what the account buys, and an
              App Review screenshot would quote that sentence straight back at us
              under 5.1.1(v). Name only what signing up actually unlocks. */}
          <Text style={styles.tagline}>
            {gateCopy ?? 'Free account — save deals, message sellers and get alerted the moment a match lands.'}
          </Text>

          {!configured && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Supabase isn&apos;t configured yet — set the EXPO_PUBLIC_SUPABASE_* env vars (see README).
              </Text>
            </View>
          )}

          <View style={{ height: space.xl }} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@email.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            placeholder="At least 8 characters"
          />

          <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)}>
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.agreeText}>
              I agree to the{' '}
              <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>Terms & EULA</Text>
              {' '}and{' '}
              <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>Privacy Policy</Text>.
              I understand there is zero tolerance for objectionable content or abusive users.
            </Text>
          </Pressable>

          <ErrorText>{error}</ErrorText>
          <Button title="Create account" onPress={onSubmit} loading={busy} disabled={!configured} variant="accent" />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            {/* replace, not push: pushing stacks a second auth screen, so
                logging in there would router.back() onto THIS form instead of
                onto whatever the user was doing before the gate fired. */}
            <Link replace href={{ pathname: '/(auth)/login', params: reason ? { reason } : {} }} style={styles.link}>Log in</Link>
          </View>
        </ScrollView>
      </KeyboardLift>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1, justifyContent: 'center' },
  confirm: { flex: 1, justifyContent: 'center', padding: space.xl },
  closeRow: { alignSelf: 'flex-start', marginBottom: space.lg, paddingVertical: 4 },
  closeText: { color: colors.textDim, fontSize: font.body, fontWeight: '600' },
  brand: { color: colors.text, fontSize: font.h1, fontWeight: '800' },
  tagline: { color: colors.textDim, fontSize: font.body, marginTop: space.sm },
  notice: {
    backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: space.md, marginTop: space.lg,
    borderWidth: 1, borderColor: colors.warn,
  },
  noticeText: { color: colors.textDim, fontSize: font.small },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: space.lg, gap: space.md },
  checkbox: {
    width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.lime, borderColor: colors.lime },
  checkmark: { color: colors.bg, fontWeight: '900', fontSize: 14 },
  agreeText: { color: colors.textDim, fontSize: font.small, flex: 1, lineHeight: 20 },
  link: { color: colors.blue, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: space.xl },
  footerText: { color: colors.textDim, fontSize: font.body },
});
