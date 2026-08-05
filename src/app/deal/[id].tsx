import React, { useCallback, useState } from 'react';
import {
  Alert, Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Button, Card, Loading, EmptyState } from '@/components/ui';
import { EmbeddedReport } from '@/components/EmbeddedReport';
import { getDeal, saveListing, reportContent } from '@/lib/api';
import type { DealDetailResponse, MoneyLine } from '@/lib/types';
import { colors, font, radius, space } from '@/lib/theme';
import { fmtUsd, fmtBedBath, fmtCityState, fmtDate } from '@/lib/format';

const { width } = Dimensions.get('window');

// Mirrors the web deal page (bluelime.ai/deals/p/[id]) as seen on mobile: verified
// hero + metrics, photo gallery, the Flip and Rent number boxes, a trust strip, the
// seller marketing sections, a call/text contact line, and the full verified report
// (condition + rehab + comps). Same data source (/api/marketplace/deal/[id]).

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
      setSaved(!next);
    } finally {
      setSavingBusy(false);
    }
  };

  const report = () => {
    Alert.alert(
      'Report this listing',
      'Flag this deal for review by the RealtyZoom team (fraud, inaccurate, or objectionable content).',
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
  const m = deal.marketing ?? {};
  const photos = deal.photos?.length ? deal.photos : (deal.photo ? [deal.photo] : []);

  const hasVerified = deal.arv_cents != null;
  const hasPrice = deal.ask_cents != null && deal.ask_cents > 0;
  const hasProfit = deal.profit_cents != null;
  const profitPositive = (deal.profit_cents ?? 0) > 0;
  const accepting = deal.accepting_offers ?? deal.listing_state === 'active';
  const statusLabel = deal.listing_state === 'active' ? 'Available'
    : deal.listing_state === 'pending' ? 'Pending'
    : deal.listing_state === 'sold' ? 'Sold'
    : accepting ? 'Available' : 'No longer available';
  const verifiedDate = deal.verified_at ? fmtDate(deal.verified_at) : null;

  const headline = m.headline && m.headline !== deal.address ? m.headline : null;
  const phone = (m.contact?.text_line || m.contact?.phone || '').trim();
  const phoneDigits = phone.replace(/[^0-9+]/g, '');

  const specs = [
    fmtBedBath(deal.beds, deal.baths, deal.sqft),
    deal.year_built ? `built ${deal.year_built}` : null,
  ].filter(Boolean).join('  ·  ');

  const metrics = ([
    hasProfit && { label: 'Profit', value: fmtUsd(deal.profit_cents), color: profitPositive ? colors.lime : colors.danger },
    hasVerified && { label: 'ARV', value: fmtUsd(deal.arv_cents), color: colors.text },
    hasVerified && { label: 'Rehab', value: fmtUsd(deal.rehab_cents), color: colors.warn },
    hasPrice && { label: 'Price', value: fmtUsd(deal.ask_cents), color: colors.blue },
  ].filter(Boolean)) as { label: string; value: string; color: string }[];

  return (
    <>
      <Stack.Screen
        options={{
          title: deal.city ?? 'Deal',
          headerRight: () => (
            <Pressable onPress={toggleSave} disabled={savingBusy} hitSlop={12} style={styles.saveButton}>
              <Text style={[styles.saveIcon, saved && styles.saveIconActive]}>{saved ? '⭐' : '☆'}</Text>
            </Pressable>
          ),
        }}
      />

      {/* Persistent header — stays fixed while the page scrolls (web sticky-bar parity) */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyTop}>
          {photos[0] ? (
            <Image source={{ uri: photos[0] }} style={styles.stickyThumb} contentFit="cover" />
          ) : (
            <View style={[styles.stickyThumb, styles.center]} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.stickyStreet} numberOfLines={1}>{deal.address.split(',')[0]}</Text>
            <Text style={styles.stickyCity} numberOfLines={1}>
              {fmtCityState(deal.city, deal.state)}{deal.zip ? ` ${deal.zip}` : ''}
            </Text>
          </View>
          <View style={[styles.chip, accepting ? styles.chipActive : styles.chipMuted]}>
            <Text style={[styles.chipText, { color: accepting ? colors.bg : colors.textDim }]}>{statusLabel}</Text>
          </View>
        </View>
        {metrics.length > 0 && (
          <View style={styles.stickyMetrics}>
            {metrics.map((m) => (
              <View key={m.label} style={styles.stickyMetric}>
                <Text style={styles.stickyMetricLabel}>{m.label}</Text>
                <Text style={[styles.stickyMetricValue, { color: m.color }]}>{m.value}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* Photo gallery */}
        {photos.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
            {photos.map((p, i) => (
              <Image key={i} source={{ uri: p }} style={styles.galleryImg} contentFit="cover" transition={150} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.galleryImg, styles.center]}>
            <Text style={styles.faint}>No photos</Text>
          </View>
        )}

        <View style={styles.pad}>
          {/* Headline + status chips */}
          {headline ? <Text style={styles.headline}>{headline}</Text> : null}
          <View style={styles.chipRow}>
            <View style={[styles.chip, accepting ? styles.chipActive : styles.chipMuted]}>
              <Text style={[styles.chipText, { color: accepting ? colors.bg : colors.textDim }]}>{statusLabel}</Text>
            </View>
            {hasVerified && (
              <View style={styles.chipVerified}>
                <Text style={styles.chipVerifiedText}>✓ Verified{verifiedDate ? ` · ${verifiedDate}` : ''}</Text>
              </View>
            )}
            {deal.contract_verified && (
              <View style={styles.chipContract}>
                <Text style={styles.chipContractText}>✓ Contract on file</Text>
              </View>
            )}
          </View>

          {/* Address */}
          <Text style={styles.address}>{deal.address.split(',')[0]}</Text>
          <Text style={styles.location}>{fmtCityState(deal.city, deal.state)}{deal.zip ? ` ${deal.zip}` : ''}</Text>
          {specs ? <Text style={styles.specs}>{specs}  ·  <Text style={{ color: colors.blue }}>⚡ verified by RealtyZoom</Text></Text> : null}

          {/* Flip box */}
          {hasProfit && (
            <NumberBox
              leftLabel="Offered price" leftValue={fmtUsd(deal.ask_cents)} leftColor={colors.blue}
              rightLabel="Flip estimated profit" rightValue={fmtUsd(deal.profit_cents)} rightColor={profitPositive ? colors.lime : colors.warn}
              rows={[
                { label: 'After-repair value (ARV)', value: fmtUsd(deal.arv_cents) },
                { label: 'Estimated rehab', value: `−${fmtUsd(deal.rehab_cents)}` },
                { label: 'Offered price', value: `−${fmtUsd(deal.ask_cents)}` },
                { label: 'Closing, selling & holding (est.)', value: `−${fmtUsd(deal.costs_cents)}`, detail: deal.cost_lines },
              ]}
              totalLabel="Flip estimated profit"
              totalValue={fmtUsd(deal.profit_cents)}
              totalColor={profitPositive ? colors.lime : colors.warn}
              note="Renovate to ARV and resell. Assumes a cash purchase (no loan). Estimate only — verify before purchase."
            />
          )}

          {/* Rent box */}
          {deal.rent ? (
            <NumberBox
              leftLabel="Monthly rent" leftValue={fmtUsd(deal.rent.rent_cents)} leftColor={colors.blue}
              rightLabel="Net cash flow / mo" rightValue={fmtUsd(deal.rent.net_monthly_cents)}
              rightColor={deal.rent.net_monthly_cents >= 0 ? colors.lime : colors.warn}
              rows={[
                { label: 'Gross monthly rent', value: fmtUsd(deal.rent.rent_cents) },
                { label: 'Operating costs (est.)', value: `−${fmtUsd(deal.rent.op_costs_cents)}`, detail: deal.rent.op_cost_lines },
                { label: 'Debt service (mortgage)', value: `−${fmtUsd(deal.rent.debt_service_cents)}`, detail: deal.rent.debt_lines },
              ]}
              totalLabel="Net monthly cash flow"
              totalValue={fmtUsd(deal.rent.net_monthly_cents)}
              totalColor={deal.rent.net_monthly_cents >= 0 ? colors.lime : colors.warn}
              footRow={`Cap rate ${deal.rent.cap_rate_pct.toFixed(1)}%    ·    Cash-on-cash ${deal.rent.cash_on_cash_pct.toFixed(1)}%`}
              note="Buy & hold, financed at 25% down, 7.25% 30-yr fixed. Vacancy 6% · mgmt 8% · maintenance 8% + taxes & insurance. Estimate only."
            />
          ) : hasVerified ? (
            <Card style={{ marginTop: space.md }}>
              <Text style={styles.metricLabel}>AS A RENTAL</Text>
              <Text style={[styles.faint, { marginTop: space.xs }]}>A long-term rent estimate isn&apos;t available for this address yet.</Text>
            </Card>
          ) : null}

          {/* Trust strip */}
          {hasVerified && (
            <View style={styles.trust}>
              <TrustCard title="✓ Verified numbers" body="ARV and rehab computed by our engine from like-for-like comps — not the seller's claim." accent={colors.lime} />
              <TrustCard
                title={deal.contract_verified ? '✓ Contract on file' : 'One assignment, no chains'}
                body={deal.contract_verified
                  ? 'The seller holds an executed contract on this property — verified, not a daisy chain.'
                  : 'Sellers list their own controlled deals here — no re-shopped contracts.'}
                accent={deal.contract_verified ? colors.lime : colors.textDim}
              />
              <TrustCard title="Everything on one page" body="The profit you see is after the ask — the spread's already in the math. No hidden fees." accent={colors.lime} />
            </View>
          )}

          {/* Marketing sections */}
          {m.description ? (
            <Section title="About this deal"><MarketingText text={m.description} /></Section>
          ) : null}
          {m.offer_terms ? (
            <Section title="Required offer terms">
              {m.offer_terms.split(/\r?\n/).map((t) => t.replace(/^[•\-*]\s+/, '').trim()).filter(Boolean).map((t, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.para}>{t}</Text>
                </View>
              ))}
            </Section>
          ) : null}
          {m.offer_process ? (
            <Section title="Offer process & agent commission"><MarketingText text={m.offer_process} /></Section>
          ) : null}

          {/* Contact — one number for call + text */}
          {phone ? (
            <Card style={{ marginTop: space.md }}>
              <Text style={styles.value}>Prefer to talk?</Text>
              <Text style={[styles.para, { marginTop: space.xs }]}>
                <Text style={styles.link} onPress={() => Linking.openURL(`tel:${phoneDigits}`)}>Call</Text>
                <Text style={styles.faint}> or </Text>
                <Text style={styles.link} onPress={() => Linking.openURL(`sms:${phoneDigits}`)}>text</Text>
                <Text style={styles.textDim}> {phone}</Text>
              </Text>
            </Card>
          ) : null}

          {/* ── The full report ──
              Rendered by embedding the canonical web report (comps w/ multiple
              photos + click-to-enlarge, adjustments, condition grid, expand-all)
              so it's byte-for-byte the mobile-browser report and never drifts. */}
          {/* TEMP build marker — confirms the phone is running current JS.
              Remove once the dev-client + Metro pipeline is verified. */}
          <View style={{ marginTop: space.lg, backgroundColor: colors.lime, borderRadius: radius.sm, padding: space.sm }}>
            <Text style={{ color: colors.bg, fontWeight: '800', textAlign: 'center' }}>
              ✅ BUILD MARKER 7 — inline report active
            </Text>
          </View>

          {(rpt.condition || rpt.condition_score != null || rpt.rehab_items.length > 0 || rpt.comps.length > 0) && id && (
            // Full-bleed: cancel the parent `pad` (space.lg) horizontal padding so the
            // embedded web report spans the entire screen width instead of sitting in a
            // narrow center column. The web report supplies its own (small) gutter.
            <View style={{ marginTop: space.lg, marginHorizontal: -space.lg }}>
              <EmbeddedReport dealId={id} />
            </View>
          )}

          <Pressable onPress={report} style={styles.reportBtn} hitSlop={8}>
            <Text style={styles.faint}>⚑ Report this listing</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      {accepting && (
        <View style={styles.actionBar}>
          <Button title="Message seller" variant="outline" onPress={() => router.push(`/messages/${id}`)} style={{ flex: 1 }} />
          <Button title="Make offer" variant="accent" onPress={() => router.push(`/offer/${id}`)} style={{ flex: 1 }} />
        </View>
      )}
    </>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

type BoxRow = { label: string; value: string; detail?: MoneyLine[] };

function NumberBox({
  leftLabel, leftValue, leftColor, rightLabel, rightValue, rightColor,
  rows, totalLabel, totalValue, totalColor, footRow, note,
}: {
  leftLabel: string; leftValue: string; leftColor: string;
  rightLabel: string; rightValue: string; rightColor: string;
  rows: BoxRow[];
  totalLabel: string; totalValue: string; totalColor: string;
  footRow?: string; note: string;
}) {
  return (
    <View style={styles.box}>
      <View style={styles.boxHeader}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.boxHeadLabel}>{leftLabel}</Text>
          <Text style={[styles.boxHeadValue, { color: leftColor }]}>{leftValue}</Text>
        </View>
        <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
          <Text style={styles.boxHeadLabel}>{rightLabel}</Text>
          <Text style={[styles.boxHeadValue, { color: rightColor }]}>{rightValue}</Text>
        </View>
      </View>
      <View style={styles.boxBody}>
        {rows.map((r, i) => (
          <View key={i}>
            <View style={styles.boxRow}>
              <Text style={styles.boxRowLabel}>{r.label}</Text>
              <Text style={styles.boxRowValue}>{r.value}</Text>
            </View>
            {r.detail?.length ? (
              <View style={styles.boxDetail}>
                {r.detail.map((d, j) => (
                  <View key={j} style={styles.boxDetailRow}>
                    <Text style={styles.boxDetailLabel}>{d.label}</Text>
                    <Text style={styles.boxDetailValue}>{d.text ?? fmtUsd(d.cents)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.boxTotal}>
        <Text style={styles.boxTotalLabel}>{totalLabel}</Text>
        <Text style={[styles.boxTotalValue, { color: totalColor }]}>{totalValue}</Text>
      </View>
      {footRow ? <Text style={styles.boxFoot}>{footRow}</Text> : null}
      <Text style={styles.boxNote}>{note}</Text>
    </View>
  );
}

function TrustCard({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <View style={styles.trustCard}>
      <Text style={[styles.trustTitle, { color: accent }]}>{title}</Text>
      <Text style={styles.trustBody}>{body}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginTop: space.md }}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ marginTop: space.xs }}>{children}</View>
    </Card>
  );
}

// Free-text: blank lines → paragraphs; lines starting •/-/* → bullets.
function MarketingText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (/^[•\-*]\s+/.test(line)) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.para}>{line.replace(/^[•\-*]\s+/, '')}</Text>
            </View>
          );
        }
        return <Text key={i} style={[styles.para, { marginTop: space.xs }]}>{line}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 110 },
  pad: { padding: space.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  gallery: { height: 240 },
  galleryImg: { width, height: 240, backgroundColor: colors.surfaceAlt },

  // A bare ☆/⭐ Text glyph had zero contrast against the header's navy
  // background (Ryan, 2026-08-05) — ☆ renders as a thin dark text-presentation
  // outline with no color set. A translucent circular chip + explicit bright
  // color on the glyph makes it read as a tappable control at a glance; ⭐'s
  // own built-in emoji color already shows up fine once saved.
  saveButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(242,247,252,0.14)',
    borderWidth: 1, borderColor: 'rgba(242,247,252,0.4)',
  },
  saveIcon: { fontSize: 20, color: colors.white },
  saveIconActive: { color: colors.warn },

  headline: { color: colors.lime, fontSize: font.body, fontWeight: '700', marginBottom: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  chip: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4 },
  chipActive: { backgroundColor: colors.lime },
  chipMuted: { backgroundColor: colors.surfaceAlt },
  chipText: { fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipVerified: {
    borderWidth: 1, borderColor: 'rgba(125,226,75,0.3)', backgroundColor: 'rgba(125,226,75,0.12)',
    borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4,
  },
  chipVerifiedText: { color: colors.lime, fontSize: font.tiny, fontWeight: '700' },
  chipContract: {
    borderWidth: 1, borderColor: 'rgba(125,226,75,0.3)', backgroundColor: 'rgba(125,226,75,0.12)',
    borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4,
  },
  chipContractText: { color: colors.lime, fontSize: font.tiny, fontWeight: '700' },

  address: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  location: { color: colors.textDim, fontSize: font.body, marginTop: 2 },
  specs: { color: colors.textFaint, fontSize: font.small, marginTop: space.xs },
  metricLabel: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Persistent (sticky) header
  stickyBar: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  stickyTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stickyThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  stickyStreet: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  stickyCity: { color: colors.textFaint, fontSize: font.tiny, marginTop: 1 },
  stickyMetrics: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, marginTop: space.sm },
  stickyMetric: { alignItems: 'center', flex: 1 },
  stickyMetricLabel: { color: colors.textFaint, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  stickyMetricValue: { fontSize: font.small, fontWeight: '800', marginTop: 1 },

  box: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, marginTop: space.md,
  },
  boxHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  boxHeadLabel: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  boxHeadValue: { fontSize: font.h1, fontWeight: '800', marginTop: 2 },
  boxBody: { marginTop: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md, gap: 6 },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  boxRowLabel: { color: colors.textDim, fontSize: font.small, flex: 1 },
  boxRowValue: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  boxDetail: {
    marginTop: 4, marginLeft: space.md, paddingLeft: space.md, borderLeftWidth: 2, borderLeftColor: colors.border, gap: 2,
  },
  boxDetailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  boxDetailLabel: { color: colors.textFaint, fontSize: font.tiny, flex: 1 },
  boxDetailValue: { color: colors.textDim, fontSize: font.tiny },
  boxTotal: {
    flexDirection: 'row', justifyContent: 'space-between', gap: space.md,
    marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm,
  },
  boxTotalLabel: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  boxTotalValue: { fontSize: font.body, fontWeight: '800' },
  boxFoot: { color: colors.textDim, fontSize: font.small, marginTop: space.sm },
  boxNote: { color: colors.textFaint, fontSize: font.tiny, marginTop: space.sm, lineHeight: 15 },

  trust: { marginTop: space.lg, gap: space.sm },
  trustCard: { backgroundColor: 'rgba(18,40,61,0.6)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  trustTitle: { fontSize: font.small, fontWeight: '700' },
  trustBody: { color: colors.textDim, fontSize: font.small, marginTop: 3, lineHeight: 18 },

  cardTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  value: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  textDim: { color: colors.textDim },
  body: { color: colors.textDim, fontSize: font.small, lineHeight: 20 },
  faint: { color: colors.textFaint, fontSize: font.small },
  mono: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  para: { color: colors.textDim, fontSize: font.small, lineHeight: 20, flex: 1 },
  link: { color: colors.lime, fontSize: font.small, fontWeight: '700' },
  bulletRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  bullet: { color: colors.textFaint, fontSize: font.small, lineHeight: 20 },

  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl },
  reportTitle: { color: colors.text, fontSize: font.h2, fontWeight: '800' },

  rehabRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  compCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', marginTop: space.sm,
  },
  compPhoto: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.surfaceAlt },
  compBody: { padding: space.md, gap: 2 },
  compPrice: { color: colors.lime, fontSize: font.small, fontWeight: '800' },
  compTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  compTag: {
    color: colors.textDim, fontSize: font.tiny, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden',
  },

  reportBtn: { marginTop: space.xl, alignSelf: 'center', padding: space.md },
  actionBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.md,
    padding: space.lg, paddingBottom: space.xl, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
