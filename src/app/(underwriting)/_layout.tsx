import React from 'react';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { colors } from '@/lib/theme';

// Underwriting (supply side) — Submit a new deal, Reports (all your
// underwritings), Listings (the ones live on the marketplace), and Buyers
// (interest on your listings). Profile lives in the shared TopBar (top-right).
function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function UnderwritingLayout() {
  return (
    <Tabs
      initialRouteName="reports"
      screenOptions={{
        header: () => <TopBar active="underwriting" />,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textFaint,
      }}
    >
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }} />
      <Tabs.Screen name="submit" options={{ title: 'Submit', tabBarIcon: ({ color }) => <TabIcon icon="➕" color={color} /> }} />
      <Tabs.Screen name="listings" options={{ title: 'Listings', tabBarIcon: ({ color }) => <TabIcon icon="🏷️" color={color} /> }} />
      <Tabs.Screen name="buyers" options={{ title: 'Buyers', tabBarIcon: ({ color }) => <TabIcon icon="👥" color={color} /> }} />
    </Tabs>
  );
}
