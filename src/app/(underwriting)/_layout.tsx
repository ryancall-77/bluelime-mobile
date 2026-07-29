import React from 'react';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { UnderwritingTabBar } from '@/components/UnderwritingTabBar';

// Underwriting (supply side), ordered as a left-to-right pipeline —
// Underwrite (run a new deal) › Reports (all your underwritings) › Listings
// (live on the marketplace) › Buyers (interest on your listings). The custom
// tab bar draws a chevron between each step. Profile lives in the shared TopBar.
function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function UnderwritingLayout() {
  return (
    <Tabs
      initialRouteName="reports"
      tabBar={(props) => <UnderwritingTabBar {...props} />}
      screenOptions={{ header: () => <TopBar active="underwriting" /> }}
    >
      <Tabs.Screen name="submit" options={{ title: 'Underwrite', tabBarIcon: ({ color }) => <TabIcon icon="➕" color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }} />
      <Tabs.Screen name="listings" options={{ title: 'Listings', tabBarIcon: ({ color }) => <TabIcon icon="🏷️" color={color} /> }} />
      <Tabs.Screen name="buyers" options={{ title: 'Buyers', tabBarIcon: ({ color }) => <TabIcon icon="👥" color={color} /> }} />
    </Tabs>
  );
}
