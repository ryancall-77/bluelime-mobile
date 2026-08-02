import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Button, Field, Card, ErrorText } from '@/components/ui';
import { makeOffer } from '@/lib/api';
import { readFileBytes, type FileBytes } from '@/lib/upload';
import { dollarsToCents, fmtUsd } from '@/lib/format';
import { colors, font, radius, space } from '@/lib/theme';

export default function OfferFlow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [terms, setTerms] = useState('');
  const [pof, setPof] = useState<(FileBytes) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const cents = dollarsToCents(amount);

  const pickDocument = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      const bytes = await readFileBytes(a.uri, a.name ?? 'proof-of-funds', a.mimeType ?? 'application/octet-stream');
      setPof(bytes);
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
      const bytes = await readFileBytes(a.uri, a.fileName ?? 'proof-of-funds.jpg', a.mimeType ?? 'image/jpeg');
      setPof(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image');
    }
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError('Enter your name.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError('Enter a valid email.'); return; }
    if (!cents || cents <= 0) { setError('Enter a valid offer amount.'); return; }
    setBusy(true);
    try {
      await makeOffer(String(id), {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        amountCents: cents,
        specialTerms: terms.trim() || undefined,
        pof: pof ? { bytes: pof.bytes, fileName: pof.fileName, mimeType: pof.mimeType } : null,
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

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Your name" value={name} onChangeText={setName} placeholder="Full name" />
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@email.com" />
          <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(555) 123-4567" />
          <Field
            label="Offer amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="e.g. 185000"
          />
          {cents != null && <Text style={styles.hint}>{fmtUsd(cents)}</Text>}
          <Field
            label="Special terms (optional)"
            value={terms}
            onChangeText={setTerms}
            placeholder="Cash, 7-day close, inspection contingency…"
            multiline
            style={{ height: 90, textAlignVertical: 'top' }}
          />

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

          <ErrorText>{error}</ErrorText>
          <Button title="Submit offer" onPress={submit} loading={busy} variant="accent" />
          <Text style={styles.disclaimer}>
            Submitting sends your offer and any attached document to the seller. Numbers shown on the deal are
            RealtyZoom-verified estimates, not a guarantee.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  label: { color: colors.textDim, fontSize: font.small, marginBottom: space.xs, fontWeight: '600' },
  hint: { color: colors.lime, fontSize: font.small, marginTop: -space.sm, marginBottom: space.md, fontWeight: '700' },
  pofRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  pofName: { color: colors.text, fontSize: font.small, flex: 1, marginRight: space.md },
  pofHint: { color: colors.textDim, fontSize: font.small, marginBottom: space.md },
  remove: { color: colors.danger, fontSize: font.small, fontWeight: '700' },
  pofBtns: { flexDirection: 'row', gap: space.md },
  disclaimer: { color: colors.textFaint, fontSize: font.tiny, marginTop: space.md, lineHeight: 16 },
  doneWrap: { flex: 1, justifyContent: 'center', padding: space.xl },
  doneTitle: { color: colors.text, fontSize: font.h1, fontWeight: '800', textAlign: 'center' },
  doneBody: { color: colors.textDim, fontSize: font.body, textAlign: 'center', marginTop: space.md, lineHeight: 22 },
});
