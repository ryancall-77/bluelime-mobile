import React from 'react';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { colors } from '@/lib/theme';

// Marketplace (buyer side) — mirrors InvestorLift's bottom bar: Search,
// Favorites, Offers, Messages. Profile lives in the shared TopBar (top-right),
// not the bottom bar. Swap between Marketplace/Underwriting via the TopBar toggle.
function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
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
      <Tabs.Screen name="index" options={{ title: 'Search', tabBarIcon: ({ color }) => <TabIcon icon="🔍" color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites', tabBarIcon: ({ color }) => <TabIcon icon="❤️" color={color} /> }} />
      <Tabs.Screen name="offers" options={{ title: 'Offers', tabBarIcon: ({ color }) => <TabIcon icon="💲" color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color }) => <TabIcon icon="💬" color={color} /> }} />
    </Tabs>
  );
}
