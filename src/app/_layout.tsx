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

// Routes reachable WITHOUT an account. The app is browsable signed-out — the deal
// list, a deal detail, its photos, the full underwriting report and the underwrite
// funnel are the product demo, so a guest gets to see them before being asked for
// anything (Ryan, 2026-08-20). Everything else — favorites, offers, messaging, the
// buy-box, prepare/progress — still needs a session.
//
// A screen belongs here when it GATES ITSELF: the allowlist and the in-file
// <SignInPrompt/> are two halves of one decision, and listing only one of them is
// how the (underwriting) group ended up with four sign-in prompts that could never
// render (fixed 2026-08-21).
//
// `useSegments()` returns the route PATTERN, not the resolved values, so
// `underwriting/[id]` and `underwriting/new` are distinguishable here even though
// both are two segments long.
//
// Typed as readonly string[] on purpose: the parameter type is a union of route
// tuples, and comparing that against a literal TS does not know about is a
// "no overlap" error rather than the `false` we want.
function isPublicRoute(segments: readonly string[]): boolean {
  const [first, second] = segments;
  // '/' itself — index.tsx redirects to /home.
  if (first === undefined) return true;
  if (first === '(auth)' || first === '(marketplace)') return true;
  // The whole underwriting group. It gates itself IN-FILE — submit is the public
  // landing screen and reports/listings/buyers each render <SignInPrompt/> — but
  // without this line the backstop below redirected a guest before any of those
  // screens mounted, so every one of those prompts was dead code AND the TopBar's
  // Deals|Underwrite toggle stranded a signed-out user on a login screen with no
  // Close and nothing to go back to (everything in that chain uses router.replace,
  // so canGoBack() was false). `underwriting/new` stays OFF the list below: it is
  // only ever reached from a signed-in push.
  if (first === '(underwriting)') return true;
  if (first === 'deal') return true;
  if (first === 'terms' || first === '+not-found') return true;
  // /account gates itself in-file and its GUEST view is load-bearing: it carries the
  // Support & legal card that proves to App Review that support, the EULA and the
  // privacy policy are reachable without an account. Redirecting a guest to login
  // here hid exactly the screen review is looking for.
  if (first === 'account') return true;
  // The canned demo report. Open by definition — it is what a brand-new install
  // is shown BEFORE it has anything of its own.
  if (first === 'sample-report') return true;
  // The owner report is credentialed by its access token in the URL, not by a
  // session — a guest who taps a shared link must be able to open it.
  if (first === 'underwriting' && second === '[id]') return true;
  return false;
}

// Backstop only. The gate no longer bounces a guest off the public routes above —
// each gated ACTION prompts at the tap (see lib/gate.ts). This still catches a
// deep link, a restored navigation state, or a sign-out that leaves a guest
// standing on a genuinely private route.
function RootNavigator() {
  const { ready, signedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    // NOTE: the old `signedIn && inAuthGroup -> /(marketplace)` half is gone. It was
    // what moved a user into the app after signing in; the auth screens now navigate
    // themselves (back to whatever the user was doing, else the marketplace), because
    // a guest can legitimately be SITTING on the login screen with browsing behind it
    // and must not be yanked off it.
    if (!signedIn && !isPublicRoute(segments)) router.replace('/(auth)/login');
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
      {/* fullScreenModal, not 'modal': the sample is a full web report and the
          sheet's peek-through + swipe-to-dismiss both fight a scrolling WebView.
          headerShown false because the screen draws its own Close — a
          fullScreenModal has no dismiss gesture, so that Close is the only exit
          and it must not be a navigator button that could be styled away. */}
      <Stack.Screen name="sample-report" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
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
