// STATE A — the pitch face of the Underwrite screen.
//
// This is what a guest, and a signed-in user who has never run anything, sees before
// an address is chosen. The copy is lifted from the website homepage on purpose: the
// app store listing, the ads and this screen are the same promise, and a user who
// read one and lands on the other should recognise it word for word.
//
// It unmounts the moment an address is SELECTED from the dropdown — see submit.tsx.

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/config';
import { colors, font, radius, space } from '@/lib/theme';
import type { UnderwritePricing } from './marketingConfig';
import { useCredits, creditsLine } from './useCredits';

// ── The sample report's real numbers ────────────────────────────────────────────
// Read from app/src/app/(marketing)/sample-report/sample-data.json (5301 Wren St,
// Orlando FL) — the exact rows the web sample renders: `arv_cents`,
// `rehab_total_cents`, and `cash_mao_cents` (review-client shows
// `cash_mao_cents ?? final_cash_mao_cents`; final_cash_mao_cents is null there).
//
// Kept in CENTS and formatted here, so the derivation is visible and a future edit
// to the sample snapshot is a two-line change against a named source rather than
// three magic strings. ⚠️ If sample-data.json is ever re-snapshotted these must be
// re-read from it — a card that advertises numbers the report does not show is the
// worst possible first impression on a screen whose whole pitch is "trust the number".
const SAMPLE_ARV_CENTS = 30_965_908;
const SAMPLE_REHAB_CENTS = 3_490_800;
const SAMPLE_CASH_MAO_CENTS = 18_781_927;
const SAMPLE_NOVATION_MAO_CENTS = 20_079_652;

const usd = (cents: number) => '$' + Math.round(cents / 100).toLocaleString();

// One figure, tinted the way the finished report tints it — Cash MAO lime,
// Novation blue, Rehab amber. Deliberately the SAME visual language as the report
// screen's own strip (underwriting/[id].tsx), so the card is a genuine preview of
// what they are about to open rather than a paraphrase of it.
function Metric({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tint ? { color: tint } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNum}>{n} ·</Text>
      <Text style={styles.stepText}>{children}</Text>
    </View>
  );
}

function Reason({ lead, children }: { lead: string; children: React.ReactNode }) {
  return (
    <Text style={styles.reason}>
      <Text style={styles.reasonLead}>{lead}</Text>
      {' — '}
      {children}
    </Text>
  );
}

export function Pitch({
  pricing,
  children,
  onStart,
  canStart,
}: {
  pricing: UnderwritePricing;
  /** Advance to the form. Same effect as picking from the dropdown. */
  onStart?: () => void;
  /** An address has been chosen, so the button is live. */
  canStart?: boolean;
  /** The address field. It sits INSIDE the pitch, under "Underwrite a deal now!". */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { freeReports, priceRange } = pricing;
  const credits = useCredits();

  return (
    <View>
      {/* ── Hero ──
          "actually trust" carries a blue→lime gradient on the web. React Native has
          no text gradient without a native gradient module, and a new dependency
          here would force a paid EAS build and cut this binary off from OTA
          hotfixes — so it is rendered as the gradient's two STOPS, one word each.
          Same two brand colors, same emphasis, zero new dependencies. */}
      <Text style={styles.h1}>
        AI deal underwriting you can{' '}
        <Text style={styles.h1Blue}>actually</Text>{' '}
        <Text style={styles.h1Lime}>trust</Text>
      </Text>
      <Text style={styles.heroSmall}>Accurate Max Allowable Offers (MAO) within minutes.</Text>
      <Text style={styles.heroBody}>
        Get your real estate deals underwritten in 3-5 minutes, so you can make an offer at a price you can count on
        before the seller hangs up. Try it for free - no credit card required.
      </Text>

      {/* ── The address field ──
          Everything on this screen exists to get an address typed here, so the whole
          block is lifted onto its own lime-edged panel rather than sitting inline as
          one more paragraph in a column of paragraphs. "Fast, easy, free." gets its
          own line and the accent colour: it is the promise, not a continuation of the
          instruction, and reading them as one sentence flattened both. */}
      <View style={styles.focus}>
        <Text style={styles.fieldLead}>Underwrite a deal now!</Text>
        <Text style={styles.fieldLeadAccent}>Fast, easy, free.</Text>
        {children}
        {/* A button, even though picking from the dropdown already advances. Without a
            visible CTA under the field the section had no obvious next step and read as
            a search box rather than the start of something. Disabled until an address is
            chosen, so it can never fire on an empty or half-typed string. */}
        <Button
          title="Submit for Underwriting"
          variant="primary"
          disabled={!canStart}
          onPress={() => onStart?.()}
          style={styles.fieldBtn}
        />
        {/* Signed OUT this is the offer; signed IN it is their actual balance. Showing a
            logged-in user with credits "your first 3 reports are free" is telling them
            about a trial they already started. */}
        <Text style={styles.fieldFoot}>{creditsLine(credits, freeReports)}</Text>
      </View>

      {/* ── Sample report ── the one thing a sceptic wants before typing an address. */}
      <Pressable
        onPress={() => router.push('/sample-report')}
        style={({ pressed }) => [styles.sample, pressed && styles.samplePressed]}
        accessibilityRole="button"
      >
        <View style={styles.sampleHead}>
          <View style={styles.sampleBadge}><Text style={styles.sampleBadgeText}>SAMPLE</Text></View>
          <Text style={styles.sampleKicker}>REAL REPORT · REAL NUMBERS</Text>
        </View>
        <Text style={styles.sampleTitle}>See a full report</Text>
        <Text style={styles.sampleLede}>
          This is an actual report we ran — open it and read the whole thing, every comp and every
          repair line, before you type anything.
        </Text>
        <Text style={styles.sampleAddr}>5301 Wren St, Orlando FL</Text>
        <View style={styles.metrics}>
          <Metric label="Cash MAO" value={usd(SAMPLE_CASH_MAO_CENTS)} tint={colors.lime} />
          <Metric label="Novation" value={usd(SAMPLE_NOVATION_MAO_CENTS)} tint={colors.blue} />
        </View>
        <View style={styles.metrics}>
          <Metric label="ARV" value={usd(SAMPLE_ARV_CENTS)} />
          <Metric label="Rehab" value={usd(SAMPLE_REHAB_CENTS)} tint={colors.warn} />
        </View>
        <Button
          title="Open the sample report"
          variant="accent"
          onPress={() => router.push('/sample-report')}
          style={styles.sampleBtn}
        />
      </Pressable>

      {/* ── How it works ── */}
      <Text style={styles.sectionTitle}>How it works</Text>
      <Step n="1">Enter the address and tell us the condition.</Step>
      <Step n="2">We pull comps, price the repairs, and run the numbers.</Step>
      <Step n="3">You get ARV, rehab, and your max offer - cash, novation and subject-to.</Step>

      {/* ── Why the number holds up ── */}
      <Text style={styles.sectionTitle}>Why the number holds up</Text>
      <Reason lead="Comps you can argue with">
        Every comp we pulled stays in the report, with why each one was used or set aside.
      </Reason>
      <Reason lead="Rehab read off the photos">
        The repair budget is itemised from what the listing photos actually show, not a per-square-foot rule of thumb.
      </Reason>
      <Reason lead="Three exit prices">
        Cash, novation and subject-to each get their own max offer, with the math behind it.
      </Reason>

      {/* ── Pricing ──
          Never a hardcoded price. Both halves of this line are omitted when the
          marketing config could not be read, leaving a sentence that promises
          nothing specific rather than one that promises the wrong thing. */}
      <View style={styles.pricing}>
        <Text style={styles.pricingText}>
          {/* Signed-in users who have SPENT the trial should not read about it here
              either — this is the pricing block, and 'your first N are free' next to
              credits they paid for reads as a billing mistake. Drops to the price line
              alone once the trial is gone. */}
          {credits && credits.trialRemaining === 0
            ? ''
            : freeReports == null
              ? 'Your free trial is on us. '
              : `Your free trial includes ${freeReports} reports. `}
          {priceRange == null
            ? 'After that it is pay-per-report - no subscription, cancel nothing.'
            : `After that it is ${priceRange} per report - no subscription, cancel nothing.`}
        </Text>
      </View>

      {/* ── Legal / support ── Apple wants these reachable from the surface that asks
          for an account, not only from a Settings screen the guest never opens. */}
      <View style={styles.links}>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
          <Text style={styles.link}>Terms</Text>
        </Pressable>
        <Text style={styles.linkDot}>·</Text>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
          <Text style={styles.link}>Privacy</Text>
        </Pressable>
        <Text style={styles.linkDot}>·</Text>
        <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          <Text style={styles.link}>Support</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centred and given room to breathe. Left-aligned and tight, the hero, the small
  // print and the body ran together as one grey block on a phone.
  h1: {
    color: colors.text, fontSize: 32, fontWeight: '800', lineHeight: 38,
    textAlign: 'center', marginTop: space.lg, marginBottom: space.md,
  },
  h1Blue: { color: colors.blue },
  h1Lime: { color: colors.lime },
  heroSmall: {
    color: colors.text, fontSize: font.h3, fontWeight: '700',
    textAlign: 'center', marginBottom: space.md,
  },
  heroBody: {
    color: colors.textDim, fontSize: font.body, lineHeight: 24,
    textAlign: 'center', marginBottom: space.xxl,
  },

  // The one thing the screen is FOR. A lime edge and a lifted surface pull it out of
  // the column of paragraphs around it; without this it read as one more section.
  focus: {
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.lime, borderRadius: radius.lg,
    padding: space.lg, paddingTop: space.xl,
    marginBottom: space.xxl,
  },
  fieldLead: {
    color: colors.text, fontSize: font.h2, fontWeight: '800',
    textAlign: 'center', marginBottom: space.xs,
  },
  // Its own line, in the accent. "Fast, easy, free." is the promise; run on the end
  // of the instruction it read as filler and neither half landed.
  fieldLeadAccent: {
    color: colors.lime, fontSize: font.h2, fontWeight: '800',
    textAlign: 'center', marginBottom: space.lg,
  },
  fieldBtn: { marginTop: space.lg },
  fieldFoot: {
    color: colors.textDim, fontSize: font.small, lineHeight: 20,
    textAlign: 'center', marginTop: space.md,
  },

  // Reads as a document, not a paragraph: a lime top rule, the SAMPLE chip and a
  // real button. Previously a bordered box whose heading ("See one before you run
  // one") never actually said the words 'sample report', so what it offered was
  // left to inference.
  sample: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    borderTopWidth: 4, borderTopColor: colors.lime,
    padding: space.lg, marginBottom: space.xxl,
  },
  samplePressed: { backgroundColor: colors.surfaceAlt },
  sampleHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  sampleBadge: {
    backgroundColor: colors.lime, borderRadius: radius.sm,
    paddingHorizontal: space.sm, paddingVertical: 3,
  },
  sampleBadgeText: { color: colors.bg, fontSize: font.tiny, fontWeight: '900', letterSpacing: 1 },
  sampleKicker: { color: colors.lime, fontSize: font.small, fontWeight: '800', letterSpacing: 1, flex: 1 },
  sampleLede: { color: colors.textDim, fontSize: font.body, lineHeight: 22, marginBottom: space.lg },
  sampleBtn: { marginTop: space.sm },
  sampleTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700', marginBottom: space.xs },
  sampleAddr: { color: colors.textDim, fontSize: font.body, marginBottom: space.md },
  metrics: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  metric: { flex: 1, minWidth: 0 },
  metricLabel: {
    color: colors.textFaint, fontSize: font.small, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 2,
  },
  metricValue: { color: colors.text, fontSize: font.h3, fontWeight: '800' },


  sectionTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700', marginTop: space.lg, marginBottom: space.md },
  step: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  stepNum: { color: colors.blue, fontSize: font.body, fontWeight: '800', lineHeight: 24 },
  stepText: { color: colors.textDim, fontSize: font.body, lineHeight: 24, flex: 1 },

  reason: { color: colors.textDim, fontSize: font.body, lineHeight: 24, marginBottom: space.lg },
  reasonLead: { color: colors.text, fontWeight: '700' },

  pricing: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: space.lg, marginTop: space.sm,
  },
  pricingText: { color: colors.textDim, fontSize: font.body, lineHeight: 24 },

  links: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  link: { color: colors.textFaint, fontSize: font.body, fontWeight: '600' },
  linkDot: { color: colors.textFaint, fontSize: font.body },
});
