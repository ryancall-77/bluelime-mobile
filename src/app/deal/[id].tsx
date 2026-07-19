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
import { fmtUsd, fmtBedBath, fmtCityState, fmtMonthYear } from '@/lib/format';

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

          {/* Comparable sales — full cards, matching the web deal report */}
          {rpt.comps.length > 0 && (
            <View style={{ marginTop: space.lg }}>
              <View style={styles.compHeader}>
                <Text style={styles.cardTitle}>
                  Comparable sales <Text style={styles.compCount}>({rpt.comps.length})</Text>
                </Text>
                <Text style={styles.compSub}>
                  supports the ARV{deal.arv_cents != null ? ` of ${fmtUsd(deal.arv_cents)}` : ''}
                </Text>
              </View>
              {rpt.comps.map((c) => (
                <View key={c.id} style={styles.compCard}>
                  {c.photo ? (
                    <Image source={{ uri: c.photo }} style={styles.compPhoto} contentFit="cover" transition={150} />
                  ) : (
                    <View style={[styles.compPhoto, styles.compPhotoEmpty]}>
                      <Text style={styles.compNoPhoto}>No photo</Text>
                    </View>
                  )}
                  <View style={styles.compBody}>
                    <View style={styles.compTopRow}>
                      <Text style={styles.compAddr} numberOfLines={1}>{c.address.split(',')[0]}</Text>
                      {c.sale_price_cents != null && (
                        <Text style={styles.compPrice}>{fmtUsd(c.sale_price_cents)}</Text>
                      )}
                    </View>
                    <Text style={styles.compSpecs}>{fmtBedBath(c.beds, c.baths, c.sqft)}</Text>
                    <View style={styles.compMeta}>
                      {c.distance_miles != null && (
                        <Text style={styles.compMetaItem}>{c.distance_miles.toFixed(2)} mi away</Text>
                      )}
                      {c.sale_date ? (
                        <Text style={styles.compMetaItem}>sold {fmtMonthYear(c.sale_date)}</Text>
                      ) : null}
                      {c.similarity_pct != null && (
                        <Text style={[styles.compMetaItem, styles.compMatch]}>{c.similarity_pct}% match</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
              <Text style={styles.compFooter}>
                Every comp is a real, verified sale — pulled and sanity-checked by the engine, with the
                distance shown so you can see they&apos;re truly nearby.
              </Text>
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
  compHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    gap: space.sm, marginBottom: space.sm,
  },
  compCount: { color: colors.textFaint, fontSize: font.body, fontWeight: '400' },
  compSub: { color: colors.textFaint, fontSize: font.tiny },
  compCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', marginTop: space.sm,
  },
  compPhoto: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.surfaceAlt },
  compPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  compNoPhoto: { color: colors.textFaint, fontSize: font.tiny },
  compBody: { padding: space.md },
  compTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm },
  compAddr: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '700' },
  compPrice: { color: colors.lime, fontSize: font.small, fontWeight: '800' },
  compSpecs: { color: colors.textFaint, fontSize: font.small, marginTop: 4 },
  compMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, marginTop: 6 },
  compMetaItem: { color: colors.textFaint, fontSize: font.tiny },
  compMatch: { color: colors.lime },
  compFooter: { color: colors.textFaint, fontSize: font.tiny, marginTop: space.sm, lineHeight: 16 },
  reportBtn: { marginTop: space.xl, alignSelf: 'center', padding: space.md },
  reportText: { color: colors.textFaint, fontSize: font.small },
  actionBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.md,
    padding: space.lg, paddingBottom: space.xl, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
