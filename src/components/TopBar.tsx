import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, font } from '@/lib/theme';

// Shared top bar for both top-level modes: Bluelime mark (left), a centered
// Marketplace / Underwriting segmented toggle, and the profile avatar (right).
// Rendered as the header for every screen in the (marketplace) and
// (underwriting) tab groups, so the toggle + profile are always one tap away.

type Mode = 'marketplace' | 'underwriting';

export function TopBar({ active }: { active: Mode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (mode: Mode) => {
    if (mode === active) return;
    // (underwriting) is a route group with no index screen, so navigating to the
    // bare group path is an unmatched route — target its anchor screen (reports).
    router.replace(mode === 'marketplace' ? '/(marketplace)' : '/(underwriting)/reports');
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      {/* Left: brand */}
      <View style={styles.side}>
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>Bluelime</Text>
      </View>

      {/* Center: mode toggle (absolutely centered so it stays put regardless of side widths) */}
      <View style={styles.segmentWrap} pointerEvents="box-none">
        <View style={styles.segment}>
          <Pressable
            onPress={() => go('marketplace')}
            style={[styles.seg, active === 'marketplace' && styles.segOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: active === 'marketplace' }}
          >
            <Text style={[styles.segText, active === 'marketplace' && styles.segTextOn]}>Marketplace</Text>
          </Pressable>
          <Pressable
            onPress={() => go('underwriting')}
            style={[styles.seg, active === 'underwriting' && styles.segOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: active === 'underwriting' }}
          >
            <Text style={[styles.segText, active === 'underwriting' && styles.segTextOn]}>Underwriting</Text>
          </Pressable>
        </View>
      </View>

      {/* Right: profile */}
      <View style={[styles.side, styles.sideRight]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  side: { flexDirection: 'row', alignItems: 'center', minWidth: 72, gap: 6 },
  sideRight: { justifyContent: 'flex-end' },
  logo: { width: 24, height: 24 },
  brand: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  segmentWrap: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: space.sm,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seg: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.pill },
  segOn: { backgroundColor: colors.blue },
  segText: { color: colors.textDim, fontSize: font.small, fontWeight: '700' },
  segTextOn: { color: colors.white },
  avatar: {
    width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18 },
});
