import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { EmbeddedReport } from '@/components/EmbeddedReport';
import { colors, font, space } from '@/lib/theme';
import { API_BASE } from '@/lib/config';

// "See one before you run one" — a real, finished report a guest can read end to
// end before handing over an email address. It is the single strongest thing the
// app can show someone twenty seconds after install, which is exactly why the
// failure path below matters as much as the happy one.
const SAMPLE_PATH = '/embed/sample-report';

// The sample's headline figures, read from
// app/src/app/(marketing)/sample-report/sample-data.json (5301 Wren St, Orlando FL).
// ⚠️ Re-read these if that snapshot is ever re-cut — a strip that disagrees with the
// report underneath it is worse than no strip.
const SAMPLE = {
  address: '5301 Wren St, Orlando, FL 32807',
  cashMaoCents: 18_781_927,
  novationMaoCents: 20_079_652,
  arvCents: 30_965_908,
  rehabCents: 3_490_800,
};

const usd = (cents: number) => '$' + Math.round(cents / 100).toLocaleString();

// Same tints the finished report uses (underwriting/[id].tsx) — Cash MAO lime,
// Novation blue, Rehab amber. The numbers ARE the product, so they belong above the
// fold rather than several scrolls into a WebView the reader has to go find.
function Metric({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tint ? { color: tint } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function SampleReport() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Retry = remount. The WebView keeps no useful state across a failed load, and a
  // fresh mount also re-arms EmbeddedReport's watchdog, which reload() would not.
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // fullScreenModal has no dismiss gesture, so these two are the ONLY ways out and
  // both must work from a cold deep link with nothing underneath.
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(underwriting)/submit');
  };

  // The sample is a detour back INTO the funnel, not a dead end: the whole point of
  // reading someone else's numbers is wanting your own. dismissTo pops back to the
  // underwrite screen rather than blindly unwinding one frame, and per the SDK 57
  // docs it REPLACES the current screen when that href isn't in the stack — so a
  // cold deep link straight to the sample still lands on the right screen and needs
  // no canGoBack() fallback of its own.
  const runOne = () => router.dismissTo('/(underwriting)/submit');

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>REAL REPORT · REAL NUMBERS</Text>
          <Text style={styles.title}>Sample report</Text>
        </View>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close sample report">
          <Text style={styles.close}>✕  Close</Text>
        </Pressable>
      </View>

      {/* The numbers, up top and in the report's own colors. Without this the first
          screenful of the app's flagship proof artifact is an address and a photo
          count, and the MAOs — the entire reason to read it — sit below the fold. */}
      <View style={styles.strip}>
        <Text style={styles.stripAddr} numberOfLines={1}>{SAMPLE.address}</Text>
        <View style={styles.metrics}>
          <Metric label="Cash MAO" value={usd(SAMPLE.cashMaoCents)} tint={colors.lime} />
          <Metric label="Novation" value={usd(SAMPLE.novationMaoCents)} tint={colors.blue} />
          <Metric label="ARV" value={usd(SAMPLE.arvCents)} />
          <Metric label="Rehab" value={usd(SAMPLE.rehabCents)} tint={colors.warn} />
        </View>
      </View>

      <View style={styles.body}>
        {failed ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>Couldn&apos;t load the sample</Text>
            <Text style={styles.errorBody}>Check your connection and try again</Text>
            <Button
              title="Retry"
              onPress={() => { setFailed(false); setAttempt((n) => n + 1); }}
              style={styles.retry}
            />
          </View>
        ) : (
          <EmbeddedReport
            key={attempt}
            mode="fill"
            path={SAMPLE_PATH}
            // Swallow every OUTBOUND link. A WebView cannot inherit the app's auth — it
            // carries no Bearer and no cookie — so every link inside the report (a comp's
            // Zillow source, "Prep contract", "← Dashboard") can only ever deposit a
            // brand-new user on a web login form they have no credentials for. Handing
            // them to the in-app browser instead of the frame does not help; that is the
            // same login form in a different window. The native Close is the exit.
            //
            // ⚠️ It must NOT return true unconditionally. EmbeddedReport gives the host
            // first refusal BEFORE its own self-URL allow-rule, and on iOS
            // onShouldStartLoadWithRequest fires for the INITIAL main-frame load too
            // (react-native-webview has no initial-load exemption on Apple —
            // RNCWebViewImpl.m decidePolicyForNavigationAction). A bare `() => true`
            // therefore cancels the sample's own load and the screen can only ever show
            // a blank rectangle or the retry state, forever, on iOS only. Android is
            // unaffected, which is precisely the wrong platform to be right on.
            // Allow our own embed; refuse everything else.
            onIntercept={(url) =>
              !(url === `${API_BASE}${SAMPLE_PATH}` || url.startsWith(`${API_BASE}/embed/`))
            }
            onFailed={() => setFailed(true)}
            // A 500 from the embed route paints a blank navy rectangle exactly like an
            // offline load does. Scoped to the sample URL because react-native-webview
            // can surface subresource statuses here on some platforms, and a 404 on one
            // comp thumbnail is not a failed report.
            onHttpError={(status, url) => {
              if (status >= 400 && url.includes(SAMPLE_PATH)) setFailed(true);
            }}
          />
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Text style={styles.footNote}>This is a real report we ran.</Text>
        <Button title="Run one on your address" variant="accent" onPress={runOne} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stripAddr: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: space.md },
  metrics: { flexDirection: 'row', gap: space.md },
  metric: { flex: 1, minWidth: 0 },
  metricLabel: {
    color: colors.textFaint, fontSize: font.tiny, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 2,
  },
  metricValue: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1 },
  eyebrow: { color: colors.lime, fontSize: font.tiny, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: 2 },
  close: { color: colors.textDim, fontSize: font.body, fontWeight: '600' },
  body: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  errorTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', textAlign: 'center' },
  errorBody: { color: colors.textDim, fontSize: font.body, marginTop: space.sm, textAlign: 'center' },
  retry: { marginTop: space.xl, alignSelf: 'stretch', maxWidth: 260 },
  footer: {
    padding: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footNote: { color: colors.textDim, fontSize: font.small, textAlign: 'center', marginBottom: space.md },
});
