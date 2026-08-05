import React from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '@/lib/theme';

// Minimal shape of the tab-bar props we use (from @react-navigation/bottom-tabs,
// a transitive dep of expo-router — typed locally so we don't depend on it directly).
type TabRoute = { key: string; name: string; params?: object };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, {
    options: {
      title?: string;
      tabBarIcon?: (p: { focused: boolean; color: ColorValue; size: number }) => React.ReactNode;
    };
  }>;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

// Custom bottom bar for the (underwriting) group. Renders the tabs as a
// left-to-right pipeline — Underwrite › Reports › Listings › Buyers — with a
// chevron between each step so the flow reads as a sequence, not four peers.
// Mirrors the default bar's colors/behavior (active = blue, inactive = faint).
export function UnderwritingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.title !== undefined ? options.title : route.name;
        const focused = state.index === index;
        const color = focused ? colors.blue : colors.textFaint;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <React.Fragment key={route.key}>
            <Pressable
              onPress={onPress}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={typeof label === 'string' ? label : route.name}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                {options.tabBarIcon?.({ focused, color, size: 20 })}
              </View>
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label as string}
              </Text>
            </Pressable>
            {index < state.routes.length - 1 ? (
              <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
                ›
              </Text>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    paddingHorizontal: space.xs,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 2 },
  iconWrap: {
    width: 40, height: 26, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.surfaceAlt },
  label: { fontSize: font.tiny, fontWeight: '700' },
  chevron: { color: colors.textFaint, fontSize: 20, fontWeight: '400', paddingHorizontal: 1, marginBottom: 12 },
});
