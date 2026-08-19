import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, Field, Pill, ErrorText } from '@/components/ui';
import { KeyboardLift } from '@/components/KeyboardLift';
import { getProfile, putBuyBox } from '@/lib/api';
import { PROPERTY_TYPE_LABELS } from '@/lib/types';
import type { PropertyTypeBucket, Strategy, AlertMode, BuyBox } from '@/lib/types';
import { dollarsToCents, centsToDollarsInput } from '@/lib/format';
import { colors, font, space } from '@/lib/theme';
import { patchProfile } from '@/lib/api';

const TYPES = Object.keys(PROPERTY_TYPE_LABELS) as PropertyTypeBucket[];
const STRATEGIES: { key: Strategy; label: string }[] = [
  { key: 'flip', label: 'Flip' }, { key: 'hold', label: 'Buy & hold' }, { key: 'both', label: 'Both' },
];
const ALERT_MODES: { key: AlertMode; label: string }[] = [
  { key: 'instant', label: 'Instant' }, { key: 'digest', label: 'Daily digest' }, { key: 'off', label: 'Off' },
];

export default function BuyBoxEditor() {
  const router = useRouter();
  const [marketInput, setMarketInput] = useState('');
  const [markets, setMarkets] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [types, setTypes] = useState<PropertyTypeBucket[]>([]);
  const [minProfit, setMinProfit] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('flip');
  const [alertMode, setAlertMode] = useState<AlertMode>('instant');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((res) => {
        const b = res.buy_box;
        if (b) {
          setMarkets(b.markets ?? []);
          setPriceMin(centsToDollarsInput(b.price_min_cents));
          setPriceMax(centsToDollarsInput(b.price_max_cents));
          setTypes((b.property_types ?? []) as PropertyTypeBucket[]);
          setMinProfit(centsToDollarsInput(b.min_profit_cents));
          setAlertMode(b.alert_mode ?? 'instant');
        }
        if (res.profile?.strategy) setStrategy(res.profile.strategy);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const addMarket = () => {
    const m = marketInput.trim();
    if (m && !markets.includes(m)) setMarkets([...markets, m]);
    setMarketInput('');
  };
  const toggleType = (t: PropertyTypeBucket) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const save = async () => {
    setError(null);
    const min = dollarsToCents(priceMin);
    const max = dollarsToCents(priceMax);
    if (min != null && max != null && min > max) { setError('Price minimum is above the maximum.'); return; }
    const box: BuyBox = {
      markets,
      price_min_cents: min,
      price_max_cents: max,
      property_types: types,
      min_profit_cents: dollarsToCents(minProfit),
      min_profit_pct: null,
      alert_mode: alertMode,
    };
    setBusy(true);
    try {
      await putBuyBox(box);
      await patchProfile({ strategy }).catch(() => {}); // strategy lives on the profile
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <Screen><View style={styles.center}><Text style={styles.dim}>Loading…</Text></View></Screen>;

  return (
    <Screen>
      <KeyboardLift>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Tell us what you buy — we&apos;ll match deals and alert you the moment new ones land.</Text>

          <Text style={styles.section}>Markets</Text>
          <View style={styles.marketRow}>
            <Field
              value={marketInput}
              onChangeText={setMarketInput}
              placeholder="e.g. Jacksonville, FL or FL"
              autoCapitalize="words"
              onSubmitEditing={addMarket}
              style={{ flex: 1 }}
            />
            <Button title="Add" onPress={addMarket} variant="outline" style={styles.addBtn} />
          </View>
          <View style={styles.chips}>
            {markets.map((m) => (
              <Pressable key={m} onPress={() => setMarkets(markets.filter((x) => x !== m))}>
                <View style={styles.chip}><Text style={styles.chipText}>{m}  ✕</Text></View>
              </Pressable>
            ))}
            {markets.length === 0 && <Text style={styles.dim}>Any market</Text>}
          </View>

          <Text style={styles.section}>Price band</Text>
          <View style={styles.row}>
            <Field label="Min" value={priceMin} onChangeText={setPriceMin} keyboardType="numeric" placeholder="50000" style={{ flex: 1 }} />
            <View style={{ width: space.md }} />
            <Field label="Max" value={priceMax} onChangeText={setPriceMax} keyboardType="numeric" placeholder="300000" style={{ flex: 1 }} />
          </View>

          <Text style={styles.section}>Property types</Text>
          <View style={styles.wrap}>
            {TYPES.map((t) => (
              <Pill key={t} label={PROPERTY_TYPE_LABELS[t]} active={types.includes(t)} onPress={() => toggleType(t)} />
            ))}
          </View>

          <Text style={styles.section}>Minimum profit</Text>
          <Field value={minProfit} onChangeText={setMinProfit} keyboardType="numeric" placeholder="15000 (leave blank for platform default)" />
          <Text style={styles.help}>Deals below this gross-profit bar won&apos;t alert you. Blank = platform default (≥$15k or ≥10% of ARV).</Text>

          <Text style={styles.section}>Strategy</Text>
          <View style={styles.wrap}>
            {STRATEGIES.map((s) => <Pill key={s.key} label={s.label} active={strategy === s.key} onPress={() => setStrategy(s.key)} />)}
          </View>

          <Text style={styles.section}>Alerts</Text>
          <View style={styles.wrap}>
            {ALERT_MODES.map((a) => <Pill key={a.key} label={a.label} active={alertMode === a.key} onPress={() => setAlertMode(a.key)} />)}
          </View>

          <ErrorText>{error}</ErrorText>
          <Button title="Save buy-box" onPress={save} loading={busy} variant="accent" style={{ marginTop: space.lg }} />
        </ScrollView>
      </KeyboardLift>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { color: colors.textDim, fontSize: font.body, marginBottom: space.lg, lineHeight: 21 },
  section: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: space.lg, marginBottom: space.sm },
  marketRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  addBtn: { height: 48, paddingHorizontal: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: { backgroundColor: colors.blue, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 6 },
  chipText: { color: colors.white, fontSize: font.small, fontWeight: '600' },
  row: { flexDirection: 'row' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  help: { color: colors.textFaint, fontSize: font.tiny, marginTop: -space.xs, lineHeight: 16 },
  dim: { color: colors.textFaint, fontSize: font.small },
});
