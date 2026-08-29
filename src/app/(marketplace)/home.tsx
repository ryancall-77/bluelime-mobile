import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui';
import { getLastUnderwritingTab } from '@/lib/lastTab';
import { useAuth } from '@/lib/auth';
import { colors, font, radius, space } from '@/lib/theme';

// The introduction screen — the one place that says what RealtyZoom IS.
//
// Ryan, 2026-08-28/29. Copy is his, chosen from drafts: the headline from one
// variant, the paragraph from another. Do not rewrite it without asking — it took
// several rounds to land, and "the deals you're trying to win" in particular is
// his phrasing and is the sharpest line on the screen.
//
// ⚠️ IT LIVES INSIDE (marketplace) ON PURPOSE. First version sat at the app root
// with headerShown:false, which meant it rendered with NO TopBar and NO bottom
// tray — the app's own chrome vanished on the very first screen, and the only way
// out was one of its two buttons. Ryan: "Of course you still need to have the
// header and the tray at the bottom." Being in this group is what gives it both,
// for free, from _layout.tsx.
//
// It is registered there with `href: null` — rendered by the tab navigator (so the
// tray shows) but NOT itself a tab. The header is overridden to <TopBar
// active="none" /> so neither Deals nor Underwrite is highlighted: this screen is
// not one of the two modes. The header gains NO new items — Ryan asked twice for
// it to be left alone, and the logo is the way back here.
//
// Nothing on this screen is gated. A guest reads all of it and can act on either
// button, matching the deal page.

export default function Home() {
  const router = useRouter();
  const { signedIn } = useAuth();

  const goDeals = useCallback(() => router.replace('/(marketplace)'), [router]);

  // Same ladder TopBar uses: a guest goes to Submit (the public underwrite landing
  // screen); a signed-in user resumes the tray tab they were last on. The
  // `(underwriting)` group has no index route, so the bare path is unmatched and
  // must never be navigated to directly.
  const goUnderwrite = useCallback(() => {
    if (!signedIn) { router.replace('/(underwriting)/submit'); return; }
    getLastUnderwritingTab().then(tab => router.replace(`/(underwriting)/${tab}`));
  }, [router, signedIn]);

  return (
    // edges WITHOUT 'top': the Tabs navigator already renders TopBar above this,
    // and the default top edge would pad a second time (the exact double-gap
    // ui.tsx's own comment warns about).
    <Screen edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The full lockup, large — this is the one screen where the brand gets to
            be the first thing you see. 800x200 source, held to its 4:1 aspect. */}
        <Image
          source={require('../../../assets/images/brand-wide.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="RealtyZoom"
        />

        <Text style={styles.welcome}>Welcome to RealtyZoom</Text>

        <Text style={styles.h1}>An expert-level AI underwriter, on every deal.</Text>

        <Text style={styles.lede}>
          Browse investment deals we&apos;ve already underwritten — every comp, every rehab
          line, shown. And have the AI generate accurate maximum offers (MAOs) for the
          deals you&apos;re trying to win, in about four minutes.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.card, styles.cardPrimary, pressed && styles.pressed]}
          onPress={goDeals}
          accessibilityRole="button"
        >
          <Text style={styles.cardTitle}>Browse deals</Text>
          <Text style={styles.cardBody}>
            Investment properties for sale, each one already underwritten. See the numbers
            and the work behind them before you make an offer.
          </Text>
          <Text style={styles.cardGo}>See what&apos;s available  →</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.card, styles.cardAccent, pressed && styles.pressed]}
          onPress={goUnderwrite}
          accessibilityRole="button"
        >
          <Text style={styles.cardTitle}>Underwrite a property</Text>
          <Text style={styles.cardBody}>
            Enter any address and get the same report — after-repair value, rehab priced
            line by line, and your maximum offer.
          </Text>
          <Text style={[styles.cardGo, { color: colors.lime }]}>Enter an address  →</Text>
        </Pressable>

        {/* No account, no address, nothing to fill in — just a finished report. The
            only way someone with neither can see what the product produces. */}
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
  logo: { width: 232, height: 58, alignSelf: 'center', marginTop: space.md },
  welcome: {
    color: colors.textDim, fontSize: font.body, fontWeight: '700',
    textAlign: 'center', marginTop: -space.xs,
  },
  h1: {
    color: colors.text, fontSize: font.h2, fontWeight: '800',
    lineHeight: 29, textAlign: 'center', marginTop: space.xs,
  },
  lede: { color: colors.textDim, fontSize: font.body, lineHeight: 22, textAlign: 'center' },

  card: {
    borderRadius: radius.lg, padding: space.lg,
    backgroundColor: colors.surface, borderWidth: 1, gap: 6,
  },
  // The two halves of the product get the two brand colours, so which one you are
  // looking at reads before a word of it does.
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
