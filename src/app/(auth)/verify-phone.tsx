import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Button, Field, ErrorText } from '@/components/ui';
import { KeyboardLift } from '@/components/KeyboardLift';
import { colors, font, space } from '@/lib/theme';
import { startPhoneVerify, confirmPhoneVerify } from '@/lib/api';
import { markNeedsBuyBox } from '@/lib/onboarding';
import { isSupplyReason, type GateReason } from '@/lib/gate';

// Phone verification, required right after signup (Ryan, 2026-09-07): with email
// confirmation off, an account cost nothing to create, and provision-org.ts used
// to hand every one of them 3 free RPR-backed underwriting reports — an
// unlimited number of throwaway emails meant unlimited free reports, each of
// which spends real money. Verifying a real phone (and capping ONE verified
// account per number, migration 237) is the actual anti-abuse control; the
// signup screen no longer decides anything about report access.
//
// This screen is reached ONLY from signup (see signup.tsx) — an existing user
// signing back in already has a session and, if they verified before, needs no
// screen at all. It is not part of the login screen itself; login stays
// email+password because Supabase's session already IS the login, and adding a
// second factor there is a different, larger decision than closing this hole.
export default function VerifyPhone() {
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: GateReason }>();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    // Same buy-box queuing signup.tsx used to do right before this screen
    // existed — preserved here so the behavior doesn't change for buyer signups.
    if (!isSupplyReason(reason)) markNeedsBuyBox();
    if (router.canGoBack()) router.back();
    else router.replace('/(marketplace)');
  };

  const sendCode = async () => {
    setError(null);
    if (!phone.trim()) { setError('Enter your mobile number.'); return; }
    setBusy(true);
    try {
      const r = await startPhoneVerify(phone);
      if ('already_verified' in r && r.already_verified) { finish(); return; }
      setStage('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a code.');
    } finally {
      setBusy(false);
    }
  };

  const checkCode = async () => {
    setError(null);
    if (!/^\d{4,10}$/.test(code.trim())) { setError('Enter the code we texted you.'); return; }
    setBusy(true);
    try {
      await confirmPhoneVerify(code.trim());
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t match.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardLift>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Verify your phone</Text>
          <Text style={styles.tagline}>
            {stage === 'phone'
              ? 'One quick step — this confirms you’re a real person before your free reports unlock.'
              : `Enter the code we just texted to ${phone}.`}
          </Text>

          <View style={{ height: space.xl }} />

          {stage === 'phone' ? (
            <>
              <Field
                label="Mobile number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="(904) 555-0100"
              />
              <ErrorText>{error}</ErrorText>
              <Button title="Text me a code" onPress={sendCode} loading={busy} variant="accent" />
            </>
          ) : (
            <>
              <Field
                label="Verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                // iOS offers the SMS code as a QuickType suggestion above the
                // keyboard when it recognizes this field — no extra plumbing
                // needed for that beyond this one prop.
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                placeholder="123456"
                maxLength={10}
              />
              <ErrorText>{error}</ErrorText>
              <Button title="Verify" onPress={checkCode} loading={busy} variant="accent" />
              <Button
                title="Use a different number"
                variant="outline"
                onPress={() => { setStage('phone'); setCode(''); setError(null); }}
                style={{ marginTop: space.md }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardLift>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1, justifyContent: 'center' },
  brand: { color: colors.text, fontSize: font.h1, fontWeight: '800' },
  tagline: { color: colors.textDim, fontSize: font.body, marginTop: space.sm },
});
