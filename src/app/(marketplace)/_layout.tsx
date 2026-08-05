import React from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { TopBar } from '@/components/TopBar';
import { colors, radius } from '@/lib/theme';

// Marketplace (buyer side) — mirrors InvestorLift's bottom bar: Search,
// Favorites, Offers, Messages. Profile lives in the shared TopBar (top-right),
// not the bottom bar. Swap between Marketplace/Underwriting via the TopBar toggle.
//
// The selected tab gets a background pill behind its icon, not just a color
// swap (Ryan, 2026-08-05 — color-only was too subtle to read as "you are here").
function TabIcon({ icon, color, focused }: { icon: string; color: ColorValue; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={{ fontSize: 18, color }}>{icon}</Text>
    </View>
  );
}

export default function MarketplaceLayout() {
  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar active="marketplace" />,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textFaint,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Search', tabBarIcon: ({ color, focused }) => <TabIcon icon="🔍" color={color} focused={focused} /> }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites', tabBarIcon: ({ color, focused }) => <TabIcon icon="❤️" color={color} focused={focused} /> }} />
      <Tabs.Screen name="offers" options={{ title: 'Offers', tabBarIcon: ({ color, focused }) => <TabIcon icon="💲" color={color} focused={focused} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, focused }) => <TabIcon icon="💬" color={color} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40, height: 26, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.surfaceAlt },
});
