import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Field, Pill, ErrorText } from '@/components/ui';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { submitUnderwriting, getSubjectSpecs, checkPropertyType } from '@/lib/api';
import { colors, space, font, radius } from '@/lib/theme';

// The supply-side submit form (shared by the Submit tab and the modal route).
// A phone can't scrape RPR, so this always runs source 'mobile_app': served by
// an RPR agent or QUEUED until one is live (the user is told, and gets a push
// when it's ready).

function toIntOrNull(s: string): number | null {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}
function toFloatOrNull(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function SubmitUnderwritingForm() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [sqft, setSqft] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [year, setYear] = useState('');
  const [pool, setPool] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Property type + the manufactured-home warning (Ryan, 2026-08-14). 5021 S
  // Parete Rd ran as stick-built when the photos show a manufactured home, and
  // RentCast, RPR and the county assessor ALL coded it single family — so the
  // only reliable catch is a human who can see the type before running.
  // Empty string = auto-detect, which is the pre-existing behaviour.
  const [propType, setPropType] = useState('');
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [mfdMessage, setMfdMessage] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Fires when an address is picked. Fills only fields still blank — a lookup
  // must never overwrite a correction the submitter deliberately typed.
  const onAddressChosen = async (addr: string) => {
    const a = addr.trim();
    if (a.length < 8) return;
    setLookingUp(true);
    try {
      const [specs, check] = await Promise.all([
        getSubjectSpecs(a).catch(() => null),
        checkPropertyType(a).catch(() => null),
      ]);
      if (specs) {
        if (!sqft && specs.sqft != null) setSqft(String(specs.sqft));
        if (!beds && specs.bedrooms != null) setBeds(String(specs.bedrooms));
        if (!baths && specs.bathrooms != null) setBaths(String(specs.bathrooms));
        if (!year && specs.year_built != null) setYear(String(specs.year_built));
        if (typeof specs.has_pool === 'boolean') setPool(specs.has_pool);
        setDetectedType(specs.property_type ?? null);
      }
      setMfdMessage(check?.signal?.suspect ? check.signal.message : null);
    } finally {
      setLookingUp(false);
    }
  };

  const PROPERTY_TYPES = ['Single Family', 'Condo', 'Townhouse', 'Manufactured', 'Multi-Family', 'Land'];

  const submit = async () => {
    const addr = address.trim();
    if (!addr) { setError('Property address is required.'); return; }
    setError(null);
    setBusy(true);
    try {
      const res = await submitUnderwriting({
        property_address: addr,
        property_sqft: toIntOrNull(sqft),
        bedrooms: toIntOrNull(beds),
        bathrooms: toFloatOrNull(baths),
        year_built: toIntOrNull(year),
        has_pool: pool,
        // Omitted when blank so the pipeline still auto-detects, as before.
        raw_property_type: propType || null,
        salesperson_comments: notes.trim() || null,
      });
      if (res.queued) {
        Alert.alert(
          'Report queued',
          res.queue_message ||
            'No agent is available right now — your report is queued and will run automatically as soon as one is. You’ll get a notification when it’s ready.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      router.replace({
        pathname: '/underwriting/[id]',
        params: { id: res.analysis_id, token: res.access_token, address: addr, status: res.status, posted: '0' },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.help}>
          Enter the property address. Beds/baths/sqft are optional — we pull them from public records and correct them
          automatically, but you can override if you already know them.
        </Text>

        <AddressAutocomplete label="Property address *" value={address} onChangeText={setAddress}
          onSelect={onAddressChosen}
          placeholder="Start typing an address…" />
        {lookingUp ? <Text style={styles.lookup}>Looking up public records…</Text> : null}

        <View style={styles.row}>
          <View style={styles.half}><Field label="Sqft" value={sqft} onChangeText={setSqft} placeholder="1,757" keyboardType="number-pad" /></View>
          <View style={styles.half}><Field label="Year built" value={year} onChangeText={setYear} placeholder="2018" keyboardType="number-pad" /></View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}><Field label="Beds" value={beds} onChangeText={setBeds} placeholder="3" keyboardType="number-pad" /></View>
          <View style={styles.half}><Field label="Baths" value={baths} onChangeText={setBaths} placeholder="2" keyboardType="decimal-pad" /></View>
        </View>

        <Text style={styles.label}>Pool</Text>
        <View style={styles.pills}>
          <Pill label="No pool" active={!pool} onPress={() => setPool(false)} />
          <Pill label="Has pool" active={pool} onPress={() => setPool(true)} />
        </View>

        <Text style={styles.label}>
          Property type{detectedType ? ` — records say ${detectedType}` : ''}
        </Text>
        <View style={styles.pills}>
          <Pill label="Auto" active={propType === ''} onPress={() => setPropType('')} />
          {PROPERTY_TYPES.map(t => (
            <Pill
              key={t}
              label={t === 'Manufactured' ? 'Manufactured' : t}
              active={propType === t}
              onPress={() => setPropType(t)}
            />
          ))}
        </View>
        {mfdMessage ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>⚠ {mfdMessage}</Text>
          </View>
        ) : null}

        <Field label="Notes (optional)" value={notes} onChangeText={setNotes}
          placeholder="Condition, seller situation, anything the analysis should know…"
          multiline numberOfLines={4} style={styles.notes} />

        {error ? <ErrorText>{error}</ErrorText> : null}

        <Button title="Run Underwriting" onPress={submit} loading={busy} style={{ marginTop: space.md }} />
        <Text style={styles.foot}>Typically ready in 4–6 minutes. We’ll notify you when it’s done.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  help: { color: colors.textDim, fontSize: font.small, lineHeight: 20, marginBottom: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  label: { color: colors.textDim, fontSize: font.small, fontWeight: '600', marginBottom: space.sm },
  pills: { flexDirection: 'row', gap: space.sm, marginBottom: space.md, flexWrap: 'wrap' },
  lookup: { color: colors.textFaint, fontSize: font.small, marginTop: -space.sm, marginBottom: space.md },
  warn: { borderWidth: 1, borderColor: '#B45309', backgroundColor: '#78350F33', borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  warnText: { color: '#FCD34D', fontSize: font.small, lineHeight: 19 },
  notes: { minHeight: 96, textAlignVertical: 'top', paddingTop: 10, borderRadius: radius.md },
  foot: { color: colors.textFaint, fontSize: font.small, textAlign: 'center', marginTop: space.md },
});
