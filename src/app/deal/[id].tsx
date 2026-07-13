import React, { useCallback, useState } from 'react';
import {
  Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Button, Card, Loading, VerifiedBadge, EmptyState } from '@/components/ui';
import { getDeal, saveListing, reportContent } from '@/lib/api';
import type { DealDetailResponse } from '@/lib/types';
import { colors, font, radius, space } from '@/lib/theme';
import { fmtUsd, fmtBedBath, fmtCityState, fmtDate } from '@/lib/format';

const { width } = Dimensions.get('window');

export default function DealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DealDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await getDeal(id);
      setData(res);
      setSaved(!!res.deal.saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this deal');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSave = async () => {
    if (!id) return;
    const next = !saved;
    setSaved(next);
    setSavingBusy(true);
    try {
      const res = await saveListing(id, next);
      setSaved(res.saved);
    } catch {
      setSaved(!next); // revert
    } finally {
      setSavingBusy(false);
    }
  };

  const report = () => {
    Alert.alert(
      'Report this listing',
      'Flag this deal for review by the Bluelime team (fraud, inaccurate, or objectionable content).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await reportContent({ target_type: 'listing', target_id: String(id), reason: 'user_reported' });
              Alert.alert('Reported', 'Thanks — our team will review this within 24 hours.');
            } catch (e) {
              Alert.alert('Could not report', e instanceof Error ? e.message : 'Try again later.');
            }
          },
        },
      ],
    );
  };

  if (error && !data) {
    return <EmptyState title="Unavailable" body={error} action={<Button title="Retry" onPress={load} />} />;
  }
  if (!data) return <Loading label="Loading deal…" />;

  const { deal, report: rpt } = data;
  const photos = deal.photos?.length ? deal.photos : (deal.photo ? [deal.photo] : []);
  const profitPositive = (deal.profit_cents ?? 0) > 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: deal.city ?? 'Deal',
          headerRight: () => (
            <Pressable onPress={toggleSave} disabled={savingBusy} hitSlop={12}>
              <Text style={{ fontSize: 22 }}>{saved ? '⭐' : '☆'}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* Gallery */}
        {photos.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
            {photos.map((p, i) => (
              <Image key={i} source={{ uri: p }} style={styles.galleryImg} contentFit="cover" transition={150} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.galleryImg, styles.galleryPlaceholder]}>
            <Text style={styles.dim}>No photos</Text>
          </View>
        )}

        <View style={styles.pad}>
          <VerifiedBadge />
          <Text style={styles.address}>{deal.address}</Text>
          <Text style={styles.location}>{fmtCityState(deal.city, deal.state)}{deal.zip ? ` ${deal.zip}` : ''}</Text>
          <Text style={styles.specs}>{fmtBedBath(deal.beds, deal.baths, deal.sqft)}{deal.year_built ? ` · Built ${deal.year_built}` : ''}</Text>

          {/* Headline numbers */}
          <View style={styles.headline}>
            <BigMetric label="Asking" value={fmtUsd(deal.ask_cents)} />
            <BigMetric label="ARV" value={fmtUsd(deal.arv_cents)} />
          </View>
          <View style={styles.headline}>
            <BigMetric label="Rehab est." value={fmtUsd(deal.rehab_cents)} />
            <BigMetric
              label="Gross profit"
              value={fmtUsd(deal.profit_cents)}
              highlight={profitPositive ? colors.lime : colors.danger}
            />
          </View>

          {/* Full P&L */}
          {deal.pnl_lines && deal.pnl_lines.length > 0 && (
            <Card style={{ marginTop: space.lg }}>
              <Text style={styles.cardTitle}>Full profit & loss <Text style={styles.est}>· estimates</Text></Text>
              {deal.pnl_lines.map((l, i) => (
                <View key={i} style={styles.pnlRow}>
                  <Text style={styles.pnlLabel}>{l.label}</Text>
                  <Text style={[styles.pnlValue, { color: l.kind === 'cost' ? colors.textDim : colors.text }]}>
                    {fmtUsd(l.cents)}
                  </Text>
                </View>
              ))}
              {deal.net_profit_cents != null && (
                <View style={[styles.pnlRow, styles.pnlNet]}>
                  <Text style={styles.pnlNetLabel}>Net profit (est.)</Text>
                  <Text style={[styles.pnlNetLabel, { color: (deal.net_profit_cents ?? 0) > 0 ? colors.lime : colors.danger }]}>
                    {fmtUsd(deal.net_profit_cents)}
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* Condition */}
          {(rpt.condition || rpt.condition_score != null) && (
            <Card style={{ marginTop: space.lg }}>
              <Text style={styles.cardTitle}>Condition</Text>
              {rpt.condition_score != null && <Text style={styles.value}>Score: {rpt.condition_score}/100</Text>}
              {rpt.condition ? <Text style={styles.body}>{rpt.condition}</Text> : null}
            </Card>
          )}

          {/* Rehab breakdown */}
          {rpt.rehab_items.length > 0 && (
            <Card style={{ marginTop: space.lg }}>
              <Text style={styles.cardTitle}>Rehab breakdown</Text>
              {rpt.rehab_items.map((r, i) => (
                <View key={i} style={styles.rehabRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.value}>{r.label}</Text>
                    {r.reasoning ? <Text style={styles.dim}>{r.reasoning}</Text> : null}
                  </View>
                  <Text style={styles.value}>{fmtUsd(r.cost_cents)}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Comps */}
          {rpt.comps.length > 0 && (
            <View style={{ marginTop: space.lg }}>
              <Text style={styles.cardTitle}>Verified comps ({rpt.comps.length})</Text>
              {rpt.comps.map((c) => (
                <Card key={c.id} style={styles.comp}>
                  {c.photo ? (
                    <Image source={{ uri: c.photo }} style={styles.compImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.compImg, styles.galleryPlaceholder]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.value} numberOfLines={1}>{c.address}</Text>
                    <Text style={styles.dim}>{fmtBedBath(c.beds, c.baths, c.sqft)}</Text>
                    <Text style={styles.dim}>
                      {c.sale_price_cents ? fmtUsd(c.sale_price_cents) : '—'}
                      {c.sale_date ? ` · ${fmtDate(c.sale_date)}` : ''}
                      {c.distance_miles != null ? ` · ${c.distance_miles.toFixed(1)} mi` : ''}
                    </Text>
                    {c.similarity_pct != null && (
                      <Text style={[styles.dim, { color: colors.blue }]}>{c.similarity_pct}% match</Text>
                    )}
                  </View>
                </Card>
              ))}
            </View>
          )}

          <Pressable onPress={report} style={styles.reportBtn} hitSlop={8}>
            <Text style={styles.reportText}>⚑ Report this listing</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View style={styles.actionBar}>
        <Button title="Message seller" variant="outline" onPress={() => router.push(`/messages/${id}`)} style={{ flex: 1 }} />
        <Button title="Make offer" variant="accent" onPress={() => router.push(`/offer/${id}`)} style={{ flex: 1 }} />
      </View>
    </>
  );
}

function BigMetric({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <View style={styles.bigMetric}>
      <Text style={styles.bigLabel}>{label}</Text>
      <Text style={[styles.bigValue, highlight ? { color: highlight } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 100 },
  pad: { padding: space.lg },
  gallery: { height: 240 },
  galleryImg: { width, height: 240, backgroundColor: colors.surfaceAlt },
  galleryPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  address: { color: colors.text, fontSize: font.h2, fontWeight: '800', marginTop: space.md },
  location: { color: colors.textDim, fontSize: font.body, marginTop: 2 },
  specs: { color: colors.textFaint, fontSize: font.small, marginTop: space.xs },
  headline: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  bigMetric: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: space.md,
  },
  bigLabel: { color: colors.textFaint, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },
  bigValue: { color: colors.text, fontSize: font.h3, fontWeight: '800', marginTop: 4 },
  cardTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginBottom: space.sm },
  est: { color: colors.textFaint, fontSize: font.small, fontWeight: '400' },
  value: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  body: { color: colors.textDim, fontSize: font.small, marginTop: space.xs, lineHeight: 20 },
  dim: { color: colors.textFaint, fontSize: font.small, marginTop: 2 },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: space.md },
  pnlLabel: { color: colors.textDim, fontSize: font.small, flex: 1 },
  pnlValue: { fontSize: font.small, fontWeight: '600' },
  pnlNet: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.md },
  pnlNetLabel: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  rehabRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  comp: { flexDirection: 'row', gap: space.md, marginTop: space.sm, alignItems: 'center' },
  compImg: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  reportBtn: { marginTop: space.xl, alignSelf: 'center', padding: space.md },
  reportText: { color: colors.textFaint, fontSize: font.small },
  actionBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.md,
    padding: space.lg, paddingBottom: space.xl, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
