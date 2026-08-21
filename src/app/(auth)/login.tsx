import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Button, Field, ErrorText } from '@/components/ui';
import { KeyboardLift } from '@/components/KeyboardLift';
import { useAuth } from '@/lib/auth';
import { colors, font, space } from '@/lib/theme';
import { EARLY_ACCESS_HEADSTART_MIN } from '@/lib/config';
import { GATE_COPY, type GateReason } from '@/lib/gate';

export default function Login() {
  const { signIn, configured, resetPassword } = useAuth();
  const router = useRouter();
  // Set when the user was pushed here by a gated tap rather than arriving at
  // launch. It selects the headline copy — it no longer decides whether an exit
  // exists (see `close` below).
  const { reason } = useLocalSearchParams<{ reason?: GateReason }>();
  const gateCopy = reason ? GATE_COPY[reason] : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // The way out. This used to render only when a `reason` param was present, on
  // the theory that a param-less arrival meant login WAS the first screen. That
  // stopped being true when the root navigator gained a BACKSTOP redirect: it
  // sends a guest here with no params at all, and because every hop in that chain
  // uses router.replace, canGoBack() is false too — so the user got a login screen
  // with no Close, no back gesture, and no way back into an app they were browsing
  // a moment earlier. Browsing is public now, so there is ALWAYS somewhere to go.
  //
  // canGoBack() is read here, in an event handler, not during render — the react
  // compiler is on and navigation state is not a render input.
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(marketplace)');
  };

  const onSubmit = async () => {
    setError(null);
    setNotice(null);
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try {
      await signIn(email, password);
      // The root gate used to do this. It cannot any more: (auth) is a public
      // group now, so "signed in and standing on login" is no longer proof that
      // the user needs moving. Go back to whatever they were browsing, and only
      // fall through to the marketplace when login WAS the first screen.
      if (router.canGoBack()) router.back();
      else router.replace('/(marketplace)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  // Until 2026-08-12 there was NO password recovery in the app at all — the web
  // login had "Forgot password?" and the app didn't, so a user who forgot theirs
  // was simply stuck with no in-app route back in.
  const onForgot = async () => {
    setError(null);
    setNotice(null);
    setResetting(true);
    try {
      await resetPassword(email);
      // Deliberately non-committal about whether the address is registered —
      // saying "no account found" would let anyone enumerate our users.
      setNotice(`If ${email.trim()} has an account, a reset link is on its way. Open it, choose a new password, then come back and log in.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset email.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Screen>
      <KeyboardLift>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={close} hitSlop={8} style={styles.closeRow} accessibilityRole="button">
            <Text style={styles.closeText}>✕  Close</Text>
          </Pressable>

          <View style={styles.hero}>
            <Image
              source={require('../../../assets/images/brand-wide.png')}
              style={styles.brandLogo}
              contentFit="contain"
              accessibilityLabel="RealtyZoom"
            />
            <Text style={styles.tagline}>Verified off-market deals. Real numbers up front.</Text>
            <View style={styles.headsUp}>
              <Text style={styles.headsUpText}>
                {gateCopy ?? `App users get every new deal a ${EARLY_ACCESS_HEADSTART_MIN}-minute head start.`}
              </Text>
            </View>
          </View>

          {!configured && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Supabase isn&apos;t configured yet. Set EXPO_PUBLIC_SUPABASE_URL and
                EXPO_PUBLIC_SUPABASE_ANON_KEY (see README) to enable sign-in.
              </Text>
            </View>
          )}

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
            autoComplete="password"
            placeholder="Your password"
          />
          <Pressable
            onPress={onForgot}
            disabled={resetting || !configured}
            hitSlop={8}
            style={styles.forgotRow}
            accessibilityRole="button"
          >
            <Text style={[styles.forgotText, (resetting || !configured) && { opacity: 0.5 }]}>
              {resetting ? 'Sending reset link…' : 'Forgot password?'}
            </Text>
          </Pressable>

          <ErrorText>{error}</ErrorText>
          {notice ? <Text style={styles.resetNotice}>{notice}</Text> : null}
          <Button title="Log in" onPress={onSubmit} loading={busy} disabled={!configured} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to RealtyZoom? </Text>
            {/* replace, not push: pushing stacks a second auth screen, so signing
                up there would router.back() onto THIS form instead of onto
                whatever the user was doing before the gate fired. */}
            <Link replace href={{ pathname: '/(auth)/signup', params: reason ? { reason } : {} }} style={styles.link}>
              Create an account
            </Link>
          </View>
        </ScrollView>
      </KeyboardLift>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1, justifyContent: 'center' },
  closeRow: { alignSelf: 'flex-start', marginBottom: space.lg, paddingVertical: 4 },
  closeText: { color: colors.textDim, fontSize: font.body, fontWeight: '600' },
  hero: { marginBottom: space.xxl },
  brand: { color: colors.text, fontSize: 34, fontWeight: '800' },
  brandLogo: { width: 220, height: 55, alignSelf: 'center' },
  tagline: { color: colors.textDim, fontSize: font.body, marginTop: space.sm },
  headsUp: {
    marginTop: space.lg, backgroundColor: 'rgba(125,226,75,0.12)', borderRadius: 12,
    borderWidth: 1, borderColor: colors.lime, padding: space.md,
  },
  headsUpText: { color: colors.lime, fontSize: font.small, fontWeight: '600' },
  notice: {
    backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: space.md, marginBottom: space.lg,
    borderWidth: 1, borderColor: colors.warn,
  },
  noticeText: { color: colors.textDim, fontSize: font.small },
  forgotRow: { alignSelf: 'flex-end', marginTop: -space.sm, marginBottom: space.md, paddingVertical: 4 },
  forgotText: { color: colors.blue, fontSize: font.small, fontWeight: '600' },
  resetNotice: {
    color: colors.lime, fontSize: font.small, lineHeight: 19, marginBottom: space.md,
    backgroundColor: 'rgba(125,226,75,0.10)', borderRadius: 10, padding: space.md, overflow: 'hidden',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: space.xl },
  footerText: { color: colors.textDim, fontSize: font.body },
  link: { color: colors.blue, fontSize: font.body, fontWeight: '700' },
});
