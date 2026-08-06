import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Button, Field, Card, ErrorText } from '@/components/ui';
import { makeOffer, getDeal, getProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { readPickedFile, type PickedFile } from '@/lib/upload';
import { dollarsToCents, fmtUsd } from '@/lib/format';
import { colors, font, space } from '@/lib/theme';

// Web parity (Ryan, 2026-08-09): every buyer here is already signed in (the
// root layout hard-gates the whole app), so this never re-asks for name/email
// like the old version did — it pulls them from the account, same as
// DealForms.tsx's OfferModal on web. Also matches web on showing the seller's
// required offer terms with an agree checkbox, gating submit the same way.
export default function OfferFlow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { email: authEmail } = useAuth();

  const [loadingContext, setLoadingContext] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [termLines, setTermLines] = useState<string[]>([]);
  const [agreed, setAgreed] = useState(false);

  const [amount, setAmount] = useState('');
  const [terms, setTerms] = useState('');
  const [pof, setPof] = useState<(PickedFile) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, dealRes] = await Promise.all([
          getProfile().catch(() => null),
          getDeal(String(id)).catch(() => null),
        ]);
        if (cancelled) return;
        if (profileRes) {
          setName(profileRes.profile.display_name ?? '');
          setEmail(profileRes.profile.email ?? authEmail ?? '');
          setPhone(profileRes.profile.phone ?? '');
        } else if (authEmail) {
          setEmail(authEmail);
        }
        const rawTerms = dealRes?.deal.marketing?.offer_terms ?? '';
        const lines = rawTerms
          .split(/\r?\n/)
          .map((t) => t.replace(/^[•\-*]\s+/, '').trim())
          .filter(Boolean);
        setTermLines(lines);
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cents = dollarsToCents(amount);
  const hasTerms = termLines.length > 0;
  const amountValid = !!cents && cents > 0;
  const canSubmit = !busy && amountValid && (!hasTerms || agreed);

  const pickDocument = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      const picked = await readPickedFile(a.uri, a.name ?? 'proof-of-funds', a.mimeType ?? 'application/octet-stream');
      setPof(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file');
    }
  };

  const pickPhoto = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Photo access is needed to attach a screenshot.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      const picked = await readPickedFile(a.uri, a.fileName ?? 'proof-of-funds.jpg', a.mimeType ?? 'image/jpeg');
      setPof(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image');
    }
  };

  const submit = async () => {
    setError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await makeOffer(String(id), {
        name: name.trim() || 'RealtyZoom buyer',
        email: email.trim(),
        phone: phone.trim() || undefined,
        amountCents: cents!,
        specialTerms: terms.trim() || undefined,
        termsAgreed: hasTerms ? agreed : undefined,
        pof: pof ? { file: pof.file, fileName: pof.fileName, mimeType: pof.mimeType } : null,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit offer');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <View style={styles.doneWrap}>
          <Text style={styles.doneTitle}>Offer submitted 🎉</Text>
          <Text style={styles.doneBody}>
            The seller has your offer{pof ? ' and proof of funds' : ''}. You&apos;ll get a push when they respond —
            track it under your offers.
          </Text>
          <Button title="Done" onPress={() => router.back()} style={{ marginTop: space.xl }} />
        </View>
      </Screen>
    );
  }

  if (loadingContext) {
    return (
      <Screen>
        <View style={styles.doneWrap}>
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field
            label="Offer amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="e.g. 185000"
            autoFocus
          />
          {cents != null && <Text style={styles.hint}>{fmtUsd(cents)}</Text>}
          <Field
            label="Special terms (optional)"
            value={terms}
            onChangeText={setTerms}
            placeholder="Close date, contingencies, anything that differs from the terms listed…"
            multiline
            style={{ height: 90, textAlignVertical: 'top' }}
          />

          {hasTerms ? (
            <View style={{ marginBottom: space.md }}>
              <Text style={styles.label}>Required offer terms</Text>
              <Card>
                {termLines.map((t, i) => (
                  <Text key={i} style={styles.termLine}>• {t}</Text>
                ))}
              </Card>
              <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
                <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                  {agreed ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <Text style={styles.agreeText}>I agree to the terms stated above, except as noted in my special terms.</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.label}>Proof of funds</Text>
          <Card style={{ marginBottom: space.md }}>
            {pof ? (
              <View style={styles.pofRow}>
                <Text style={styles.pofName} numberOfLines={1}>📎 {pof.fileName}</Text>
                <Pressable onPress={() => setPof(null)}><Text style={styles.remove}>Remove</Text></Pressable>
              </View>
            ) : (
              <Text style={styles.pofHint}>Attach a bank letter, statement, or POF screenshot. Strengthens your offer.</Text>
            )}
            <View style={styles.pofBtns}>
              <Button title="Upload file" variant="outline" onPress={pickDocument} style={{ flex: 1 }} />
              <Button title="Photo" variant="outline" onPress={pickPhoto} style={{ flex: 1 }} />
            </View>
          </Card>

          <Text style={styles.disclaimer}>
            Submitting sends your offer and any attached document to the seller. Numbers shown on the deal are
            RealtyZoom-verified estimates, not a guarantee.
          </Text>
        </ScrollView>

        {/* Pinned footer — a plain flex sibling of the ScrollView (not absolute),
            so KeyboardAvoidingView pushes it up together with the rest of the
            column and it never ends up hidden behind the keyboard/QuickType bar
            (Ryan, 2026-08-05). Mirrors deal/[id].tsx's actionBar. */}
        <View style={styles.footer}>
          <ErrorText>{error}</ErrorText>
          <Button title="Submit offer" onPress={submit} loading={busy} disabled={!canSubmit} variant="accent" />
          {!amountValid ? (
            <Text style={styles.disabledHint}>Enter an offer amount to submit.</Text>
          ) : hasTerms && !agreed ? (
            <Text style={styles.disabledHint}>Agree to the seller&apos;s terms to submit.</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xl },
  footer: {
    padding: space.lg, paddingTop: space.sm,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  label: { color: colors.textDim, fontSize: font.small, marginBottom: space.xs, fontWeight: '600' },
  hint: { color: colors.lime, fontSize: font.small, marginTop: -space.sm, marginBottom: space.md, fontWeight: '700' },
  termLine: { color: colors.text, fontSize: font.small, lineHeight: 20 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.sm },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.lime, borderColor: colors.lime },
  checkboxMark: { color: colors.bg, fontSize: 13, fontWeight: '900' },
  agreeText: { color: colors.text, fontSize: font.small, flex: 1, lineHeight: 19 },
  pofRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  pofName: { color: colors.text, fontSize: font.small, flex: 1, marginRight: space.md },
  pofHint: { color: colors.textDim, fontSize: font.small, marginBottom: space.md },
  remove: { color: colors.danger, fontSize: font.small, fontWeight: '700' },
  pofBtns: { flexDirection: 'row', gap: space.md },
  disabledHint: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'center', marginTop: space.sm },
  disclaimer: { color: colors.textFaint, fontSize: font.tiny, marginTop: space.md, lineHeight: 16 },
  doneWrap: { flex: 1, justifyContent: 'center', padding: space.xl },
  doneTitle: { color: colors.text, fontSize: font.h1, fontWeight: '800', textAlign: 'center' },
  doneBody: { color: colors.textDim, fontSize: font.body, textAlign: 'center', marginTop: space.md, lineHeight: 22 },
});
