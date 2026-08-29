import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui';
import { getLastUnderwritingTab } from '@/lib/lastTab';
import { useAuth } from '@/lib/auth';
import { colors, font, radius, space } from '@/lib/theme';

// The one screen that says what this app IS.
//
// Ryan, 2026-08-28: "we need a home page for the mobile app that explains plainly
// in very simple terms what the whole platform is all about with buttons that go
// to the marketplace or underwriting."
//
// Before this, a cold install opened straight onto a map of pins with a two-word
// Deals|Underwrite toggle and nothing anywhere explaining either. That is a
// problem for a new wholesaler and a bigger one for App Review, whose reviewer is
// not a real-estate investor: "ARV", "MAO" and "assignment fee" mean nothing to
// them, and an app that never introduces itself invites a 2.1 / 4.2 question.
//
// ── Rules this screen holds itself to ────────────────────────────────────────
// 1. PLAIN LANGUAGE. No ARV, no MAO, no comps, no assignment fee. Every line has
//    to survive being read by someone who has never flipped a house. The jargon
//    lives one tap deeper, where the context explains it.
// 2. SHORT. Roughly forty words of body copy. A pitch page nobody finishes is a
//    tap of friction that bought nothing.
// 3. NOTHING IS GATED. No account, no sign-in prompt, no paywall — a guest can
//    read all of it and act on either button. Matches the deal page, which Ryan
//    ungated the same day.
//
// The sample report is deliberately given equal billing with the two big
// buttons. It is a finished report on a real property that needs no account and
// no address to look at — for a reviewer with neither, it is the only way to see
// what the product actually produces, and it was already built and surfaced
// nowhere.

export default function Home() {
  const router = useRouter();
  const { signedIn } = useAuth();

  const goDeals = useCallback(() => router.replace('/(marketplace)'), [router]);

  // Same ladder TopBar uses: a guest goes to Submit (the public underwrite
  // landing screen); a signed-in user resumes the tray tab they were last on.
  // `(underwriting)` is a group with no index route, so the bare path is an
  // unmatched route and must never be navigated to directly.
  const goUnderwrite = useCallback(() => {
    if (!signedIn) { router.replace('/(underwriting)/submit'); return; }
    getLastUnderwritingTab().then(tab => router.replace(`/(underwriting)/${tab}`));
  }, [router, signedIn]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>RealtyZoom</Text>

        <Text style={styles.h1}>Know what a house is worth{'\n'}before you buy it.</Text>

        <Text style={styles.lede}>
          We price a property the way a buyer actually would — from what similar homes
          nearby really sold for, and what this one needs spent on it. Every number is
          computed, never typed in by a seller.
        </Text>

        <Pressable style={({ pressed }) => [styles.card, styles.cardPrimary, pressed && styles.pressed]} onPress={goDeals}>
          <Text style={styles.cardTitle}>Browse deals</Text>
          <Text style={styles.cardBody}>
            Investment properties for sale, each one already priced by us. See the full
            workings before you make an offer.
          </Text>
          <Text style={styles.cardGo}>See what&apos;s available  →</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.card, styles.cardAccent, pressed && styles.pressed]} onPress={goUnderwrite}>
          <Text style={styles.cardTitle}>Price a property</Text>
          <Text style={styles.cardBody}>
            Enter any address and get the same report on it — what it&apos;s worth fixed
            up, what the work costs, and the most you should pay.
          </Text>
          <Text style={[styles.cardGo, { color: colors.lime }]}>Enter an address  →</Text>
        </Pressable>

        {/* No account, no address, nothing to fill in — just a finished report. */}
        <Pressable
          style={({ pressed }) => [styles.sample, pressed && styles.pressed]}
          onPress={() => router.push('/sample-report')}
          accessibilityRole="button"
        >
          <Text style={styles.sampleText}>Curious what a report looks like?</Text>
          <Text style={styles.sampleLink}>See a real one  →</Text>
        </Pressable>

        <Text style={styles.foot}>
          Free to look. No account needed to browse deals or read a report.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  kicker: {
    color: colors.blue, fontSize: font.tiny, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  h1: { color: colors.text, fontSize: font.h1, fontWeight: '800', lineHeight: 34, marginTop: -space.xs },
  lede: { color: colors.textDim, fontSize: font.body, lineHeight: 22, marginBottom: space.xs },

  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    gap: 6,
  },
  // The two halves of the product get their two brand colours, so which one you
  // are looking at is legible before you read a word of it.
  cardPrimary: { borderColor: colors.blue },
  cardAccent: { borderColor: colors.limeDark },
  cardTitle: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  cardBody: { color: colors.textDim, fontSize: font.small, lineHeight: 20 },
  cardGo: { color: colors.blue, fontSize: font.small, fontWeight: '800', marginTop: space.xs },
  pressed: { opacity: 0.85 },

  sample: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.md, paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  sampleText: { color: colors.textDim, fontSize: font.small, flexShrink: 1 },
  sampleLink: { color: colors.text, fontSize: font.small, fontWeight: '800' },

  foot: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'center', marginTop: space.xs },
});
