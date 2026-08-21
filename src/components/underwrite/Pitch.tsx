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
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/config';
import { colors, font, radius, space } from '@/lib/theme';
import type { UnderwritePricing } from './marketingConfig';

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

const usd = (cents: number) => '$' + Math.round(cents / 100).toLocaleString();

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
}: {
  pricing: UnderwritePricing;
  /** The address field. It sits INSIDE the pitch, under "Underwrite a deal now!". */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { freeReports, priceRange } = pricing;

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

      {/* ── The address field, and the promise wrapped around it ── */}
      <Text style={styles.fieldLead}>Underwrite a deal now! Fast, easy, free.</Text>
      {children}
      <Text style={styles.fieldFoot}>
        {freeReports == null
          ? 'No sales calls. Your first reports are free - no card.'
          : `No sales calls. Your first ${freeReports} reports are free - no card.`}
      </Text>

      {/* ── Sample report ── the one thing a sceptic wants before typing an address. */}
      <Pressable
        onPress={() => router.push('/sample-report')}
        style={({ pressed }) => [styles.sample, pressed && styles.samplePressed]}
        accessibilityRole="button"
      >
        <Text style={styles.sampleKicker}>REAL REPORT · REAL NUMBERS</Text>
        <Text style={styles.sampleTitle}>See one before you run one</Text>
        <Text style={styles.sampleNums}>
          ARV {usd(SAMPLE_ARV_CENTS)} · Rehab {usd(SAMPLE_REHAB_CENTS)} · Cash max offer {usd(SAMPLE_CASH_MAO_CENTS)}
        </Text>
        <Text style={styles.sampleCta}>Open the sample report →</Text>
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
          {freeReports == null
            ? 'Your first reports are free. '
            : `Your first ${freeReports} reports are free. `}
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
  h1: { color: colors.text, fontSize: font.h1, fontWeight: '800', lineHeight: 34, marginBottom: space.sm },
  h1Blue: { color: colors.blue },
  h1Lime: { color: colors.lime },
  heroSmall: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: space.sm },
  heroBody: { color: colors.textDim, fontSize: font.small, lineHeight: 20, marginBottom: space.xl },

  fieldLead: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginBottom: space.md },
  fieldFoot: { color: colors.textFaint, fontSize: font.small, lineHeight: 18, marginTop: -space.xs, marginBottom: space.xl },

  sample: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, marginBottom: space.xl,
  },
  samplePressed: { backgroundColor: colors.surfaceAlt },
  sampleKicker: { color: colors.lime, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1, marginBottom: space.xs },
  sampleTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginBottom: space.sm },
  sampleNums: { color: colors.textDim, fontSize: font.small, lineHeight: 20, marginBottom: space.md },
  sampleCta: { color: colors.blue, fontSize: font.small, fontWeight: '700' },

  sectionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginBottom: space.md },
  step: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  stepNum: { color: colors.blue, fontSize: font.small, fontWeight: '800', lineHeight: 20 },
  stepText: { color: colors.textDim, fontSize: font.small, lineHeight: 20, flex: 1 },

  reason: { color: colors.textDim, fontSize: font.small, lineHeight: 20, marginBottom: space.md },
  reasonLead: { color: colors.text, fontWeight: '700' },

  pricing: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: space.lg, marginTop: space.sm,
  },
  pricingText: { color: colors.textDim, fontSize: font.small, lineHeight: 20 },

  links: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  link: { color: colors.textFaint, fontSize: font.small, fontWeight: '600' },
  linkDot: { color: colors.textFaint, fontSize: font.small },
});
