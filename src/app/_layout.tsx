import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets, useSafeAreaFrame } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';

import { View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { RunsProvider, useRuns } from '@/lib/runs';
import { RunBanner } from '@/components/RunBanner';
import { phaseOf } from '@/lib/uwStages';
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

  // Deep-link a push tap INTO THE APP. This used to call
  // WebBrowser.openBrowserAsync(url), which dropped the user on the website inside the
  // in-app browser — the same "report opens as a web page" failure as the report screen
  // itself, just via a different door (Ryan, 2026-08-19).
  //
  // The old `data.deal_id` branch was dead code: no sender ever sets that field, so
  // deal-alert taps were a silent no-op. Routing off the URL PATH fixes that too.
  //
  // Replay guard: getLastNotificationResponseAsync() re-fires on every subscription and
  // this effect re-subscribes whenever signedIn/router change. Without the guard a stale
  // tap would navigate the user away mid-task.
  const handledPush = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!signedIn) return;
    return onNotificationTap((data, identifier) => {
      if (identifier) {
        if (handledPush.current.has(identifier)) return;
        handledPush.current.add(identifier);
      }
      const url = typeof data.url === 'string' ? data.url : '';
      // access_token is 32 random bytes hex-encoded — exactly 64 hex chars, so this
      // cannot collide with a uuid. Read it from the payload when present, else from
      // the URL, so the fix works without waiting on a web deploy.
      const token = (typeof data.access_token === 'string' ? data.access_token : null)
        ?? url.match(/\/underwriting\/([0-9a-f]{64})/i)?.[1]
        ?? null;
      if (token) {
        router.push({
          pathname: '/underwriting/[id]',
          params: { id: typeof data.analysis_id === 'string' ? data.analysis_id : '', token },
        });
        return;
      }
      const deal = url.match(/\/(?:deal|marketplace\/p)\/([0-9a-f-]{36})/i)?.[1]
        ?? (typeof data.deal_id === 'string' ? data.deal_id : null);
      if (deal) router.push(`/deal/${deal}`);
    });
  }, [signedIn, router]);

  if (!ready) return <Loading label="Starting RealtyZoom Deals…" />;

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
      {/* Modal so the screen underneath stays mounted and Close returns the user to
          exactly where they were — Ryan's "they should be able to close that screen
          to get back to the app again". */}
      <Stack.Screen name="underwriting/progress/[id]" options={{ title: 'Report progress', presentation: 'modal' }} />
      <Stack.Screen name="underwriting/[id]" options={{ title: 'Underwriting', headerBackTitle: 'Back' }} />
      <Stack.Screen name="underwriting/prepare/[id]" options={{ title: 'Prepare listing', headerBackTitle: 'Back' }} />
      <Stack.Screen name="offer/[id]" options={{ title: 'Make an offer', presentation: 'modal' }} />
      <Stack.Screen name="messages/[id]" options={{ title: 'Messages' }} />
      <Stack.Screen name="seller-thread/[id]" options={{ title: 'Conversation', headerBackTitle: 'Back' }} />
      <Stack.Screen name="buybox" options={{ title: 'Your buy-box', presentation: 'modal' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms', presentation: 'modal' }} />
    </Stack>
  );
}

// Everything below the banner. The nested SafeAreaProvider is the load-bearing part:
// while the banner is visible it owns the status-bar inset, and the inner provider
// reports top = 0 to TopBar and to every <Screen edges={['top']}> underneath. Without
// it both would pad for a status bar the banner is already covering — the ~47pt
// double-gap this codebase has hit before. Nesting the PROVIDER (not just a context
// value) is required because SafeAreaView walks up to the nearest native provider.
function RootShell() {
  const outer = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const { ready, signedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { banner, extraCount, dismiss } = useRuns();

  // Never over the splash or the auth screens.
  const show = ready && signedIn && segments[0] !== '(auth)' && !!banner;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {show && banner ? (
        <RunBanner
          run={banner}
          extraCount={extraCount}
          topInset={outer.top}
          onPress={() => {
            const p = phaseOf(banner.status);
            if (p === 'processing' || p === 'queued') {
              router.push({ pathname: '/underwriting/progress/[id]', params: { id: banner.id } });
            } else {
              router.push({
                pathname: '/underwriting/[id]',
                params: { id: banner.id, token: banner.access_token, address: banner.address },
              });
            }
          }}
          onDismiss={() => dismiss(banner.id)}
        />
      ) : null}

      <SafeAreaProvider style={{ flex: 1 }} initialMetrics={{ frame, insets: outer }}>
        <RootNavigator />
      </SafeAreaProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RunsProvider>
            <StatusBar style="light" />
            <RootShell />
          </RunsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
