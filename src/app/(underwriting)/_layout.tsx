import React from 'react';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { UnderwritingTabBar } from '@/components/UnderwritingTabBar';
import { setLastUnderwritingTab } from '@/lib/lastTab';

// Underwriting (supply side), ordered as a left-to-right pipeline —
// Underwrite (run a new deal) › Reports (all your underwritings) › Listings
// (live on the marketplace) › Buyers (interest on your listings). The custom
// tab bar draws a chevron between each step. Profile lives in the shared TopBar.
//
// initialRouteName + each screen's `focus` listener keep lib/lastTab.ts's
// stored preference in sync with whichever tab is actually active, so
// TopBar's toggle can return here (Ryan, 2026-08-09). 'submit' (labeled
// "Underwrite") is the leftmost tab and the correct first-time default.
function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function UnderwritingLayout() {
  return (
    <Tabs
      initialRouteName="submit"
      tabBar={(props) => <UnderwritingTabBar {...props} />}
      screenOptions={{ header: () => <TopBar active="underwriting" /> }}
    >
      <Tabs.Screen
        name="submit"
        options={{ title: 'Underwrite', tabBarIcon: ({ color }) => <TabIcon icon="➕" color={color} /> }}
        listeners={{ focus: () => setLastUnderwritingTab('submit') }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }}
        listeners={{ focus: () => setLastUnderwritingTab('reports') }}
      />
      <Tabs.Screen
        name="listings"
        options={{ title: 'Listings', tabBarIcon: ({ color }) => <TabIcon icon="🏷️" color={color} /> }}
        listeners={{ focus: () => setLastUnderwritingTab('listings') }}
      />
      <Tabs.Screen
        name="buyers"
        options={{ title: 'Buyers', tabBarIcon: ({ color }) => <TabIcon icon="👥" color={color} /> }}
        listeners={{ focus: () => setLastUnderwritingTab('buyers') }}
      />
    </Tabs>
  );
}
