import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, font } from '@/lib/theme';
import { getLastUnderwritingTab } from '@/lib/lastTab';

// Shared top bar for both top-level modes: the RealtyZoom lockup on the left,
// with the Marketplace / Underwriting toggle and the profile avatar pushed to
// the right. Header for every screen in the (marketplace) and (underwriting)
// groups.
//
// The toggle used to be ABSOLUTELY positioned to sit dead-centre, which meant it
// overlapped the brand the moment the two together needed more than the bar's
// width — which they did (Ryan, 2026-08-02: "the buttons at the top sit on top
// of the logo"). It is a plain flex row now, so the pieces cannot collide: the
// lockup takes its fixed width, a flexible spacer pushes the controls right, and
// the toggle shrinks rather than overlapping.
//
// The lockup is the SAME artwork the website header uses (brand-wide.png,
// copied from app/public/logo-wide.png) instead of the square app icon plus a
// separate text label, so the two surfaces can't drift apart.
//
// Uses expo-image, matching DealCard/PhotoViewer/deal[id] — note it takes
// `contentFit`, not react-native Image's `resizeMode`.

type Mode = 'marketplace' | 'underwriting';

export function TopBar({ active }: { active: Mode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (mode: Mode) => {
    if (mode === active) return;
    if (mode === 'marketplace') { router.replace('/(marketplace)'); return; }
    // (underwriting) is a route group with no index screen, so navigating to the
    // bare group path is an unmatched route — target the tray tab they were
    // last on (first time ever: Submit, the leftmost tab). (Ryan, 2026-08-09)
    getLastUnderwritingTab().then((tab) => router.replace(`/(underwriting)/${tab}`));
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <Image
        source={require('../../assets/images/brand-wide.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="RealtyZoom"
      />

      {/* Flexible gap: pushes the controls right and absorbs the slack, so the
          brand and the toggle can never occupy the same pixels. */}
      <View style={styles.spacer} />

      <View style={styles.segment}>
        <Pressable
          onPress={() => go('marketplace')}
          style={[styles.seg, active === 'marketplace' && styles.segOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: active === 'marketplace' }}
          accessibilityLabel="Deals, beta"
        >
          <Text numberOfLines={1} style={[styles.segText, active === 'marketplace' && styles.segTextOn]}>
            Deals
          </Text>
          {/* Absolutely positioned, NOT inline with the label — this row already
              has just 3px of slack at 375pt (iPhone SE 3rd gen / 13 mini, the
              narrowest phone this app supports), measured against a static
              reproduction of these exact styles. An inline badge pushed it to
              overflow at 320pt. A corner badge costs the flex layout nothing. */}
          <View style={styles.betaTag} pointerEvents="none">
            <Text style={styles.betaTagText}>Beta</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => go('underwriting')}
          style={[styles.seg, active === 'underwriting' && styles.segOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: active === 'underwriting' }}
        >
          <Text numberOfLines={1} style={[styles.segText, active === 'underwriting' && styles.segTextOn]}>
            Underwrite
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/account')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Profile and account settings"
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>👤</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    gap: 8,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // Matches the lockup's own 4:1 aspect so it never distorts.
  logo: { width: 128, height: 32, flexShrink: 0 },
  spacer: { flex: 1, minWidth: 4 },
  segment: {
    flexDirection: 'row',
    flexShrink: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Tighter than before — shorter labels and less padding, so lockup + toggle +
  // avatar all fit across a narrow phone with room to spare.
  seg: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill, position: 'relative' },
  segOn: { backgroundColor: colors.blue },
  segText: { color: colors.textDim, fontSize: font.tiny, fontWeight: '700' },
  segTextOn: { color: colors.white },
  // Corner badge, not inline — see the comment above where it's rendered.
  betaTag: {
    position: 'absolute',
    top: -7,
    right: -3,
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  betaTagText: { color: colors.bg, fontSize: 7, fontWeight: '800', letterSpacing: 0.2 },
  avatar: {
    width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15 },
});
