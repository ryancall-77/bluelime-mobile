import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Link } from 'expo-router';
import { Screen, Button, Field, ErrorText } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, font, space } from '@/lib/theme';
import { EARLY_ACCESS_HEADSTART_MIN } from '@/lib/config';

export default function Login() {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.brand}>RealtyZoom <Text style={{ color: colors.lime }}>Deals</Text></Text>
            <Text style={styles.tagline}>Verified off-market deals. Real numbers up front.</Text>
            <View style={styles.headsUp}>
              <Text style={styles.headsUpText}>
                App users get every new deal a {EARLY_ACCESS_HEADSTART_MIN}-minute head start.
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
          <ErrorText>{error}</ErrorText>
          <Button title="Log in" onPress={onSubmit} loading={busy} disabled={!configured} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to RealtyZoom? </Text>
            <Link href="/(auth)/signup" style={styles.link}>Create an account</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1, justifyContent: 'center' },
  hero: { marginBottom: space.xxl },
  brand: { color: colors.text, fontSize: 34, fontWeight: '800' },
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: space.xl },
  footerText: { color: colors.textDim, fontSize: font.body },
  link: { color: colors.blue, fontSize: font.body, fontWeight: '700' },
});
