import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { AuthProvider, useAuth } from '@/lib/auth';
import { onNotificationTap } from '@/lib/push';
import { Loading } from '@/components/ui';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Redirects between the (auth) and (marketplace)/(underwriting) groups based on session state, and
// routes a tapped push notification into the deal detail.
function RootNavigator() {
  const { ready, signedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!signedIn && !inAuthGroup) router.replace('/(auth)/login');
    else if (signedIn && inAuthGroup) router.replace('/(marketplace)');
  }, [ready, signedIn, segments, router]);

  // Deep-link a push tap: a deal alert → the deal; an "underwriting ready" push
  // (carries a report url) → the report in the in-app browser.
  useEffect(() => {
    if (!signedIn) return;
    return onNotificationTap((data) => {
      if (data.deal_id) { router.push(`/deal/${data.deal_id}`); return; }
      const url = typeof data.url === 'string' ? data.url : null;
      if (url && /\/underwriting\//.test(url)) { WebBrowser.openBrowserAsync(url).catch(() => {}); }
    });
  }, [signedIn, router]);

  if (!ready) return <Loading label="Starting Bluelime Deals…" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.blue,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(marketplace)" options={{ headerShown: false }} />
      <Stack.Screen name="(underwriting)" options={{ headerShown: false }} />
      <Stack.Screen name="deal/[id]" options={{ title: 'Deal', headerBackTitle: 'Back' }} />
      <Stack.Screen name="account" options={{ title: 'Account', headerBackTitle: 'Back' }} />
      <Stack.Screen name="underwriting/new" options={{ title: 'New Underwriting', presentation: 'modal' }} />
      <Stack.Screen name="underwriting/[id]" options={{ title: 'Underwriting', headerBackTitle: 'Back' }} />
      <Stack.Screen name="offer/[id]" options={{ title: 'Make an offer', presentation: 'modal' }} />
      <Stack.Screen name="messages/[id]" options={{ title: 'Messages' }} />
      <Stack.Screen name="buybox" options={{ title: 'Your buy-box', presentation: 'modal' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
