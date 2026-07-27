import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View, type ColorValue } from 'react-native';
import { colors } from '@/lib/theme';

// Simple emoji tab icons keep the MVP dependency-light (swap for SF Symbols /
// vector icons before ship).
function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

// Top-right header actions on every tab: run a new underwriting, and open the
// profile/account settings. (Underwriting used to be buried in My Deals; the
// profile used to be a bottom tab — both are now one tap from anywhere.)
function HeaderActions() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={() => router.push('/underwriting/new')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="New underwriting"
        style={{ paddingHorizontal: 8, paddingVertical: 4 }}
      >
        <Text style={{ fontSize: 22 }}>🧮</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/account')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Profile and account settings"
        style={{ paddingHorizontal: 8, paddingVertical: 4 }}
      >
        <Text style={{ fontSize: 22 }}>👤</Text>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        headerShadowVisible: false,
        headerRight: () => <HeaderActions />,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textFaint,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Deals', tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{ title: 'Saved', tabBarIcon: ({ color }) => <TabIcon icon="⭐" color={color} /> }}
      />
      <Tabs.Screen
        name="mydeals"
        options={{ title: 'My Deals', tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }}
      />
    </Tabs>
  );
}
