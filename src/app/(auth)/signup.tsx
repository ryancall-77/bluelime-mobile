import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Screen, Button, Field, ErrorText } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, font, radius, space } from '@/lib/theme';
import { TERMS_URL, PRIVACY_URL } from '@/lib/config';
import { markNeedsBuyBox } from '@/lib/onboarding';

// Signup includes the Apple-required EULA / terms gate for UGC apps: the buyer
// must affirmatively agree before an account can be created.
export default function Signup() {
  const { signUp, configured } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

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
      markNeedsBuyBox();
      if (needsConfirm) setConfirmSent(true);
      // If email confirmation is off, the auth listener flips signedIn and the
      // root gate routes into the app automatically.
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
          <Button title="Back to login" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: space.xl }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Create your account</Text>
          <Text style={styles.tagline}>Free early access — browse verified deals and get alerts.</Text>

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
            <Link href="/(auth)/login" style={styles.link}>Log in</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1, justifyContent: 'center' },
  confirm: { flex: 1, justifyContent: 'center', padding: space.xl },
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
