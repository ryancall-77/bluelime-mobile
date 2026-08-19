import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type WebView from 'react-native-webview';
import { Button, Loading } from '@/components/ui';
import { EmbeddedReport } from '@/components/EmbeddedReport';
import { getAnalysisByToken, embedReportPath } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import type { AnalysisRow } from '@/lib/types';
import { colors, space, font } from '@/lib/theme';

// The owner's finished underwriting report, natively framed.
//
// It used to load the FULL website page in a WebView. That page's CTAs assume a desktop
// browser session and every one of them broke in the app (Ryan, on device, 2026-08-19):
// "← Dashboard" walked the WebView to the website and landed on a login screen, and
// "Prep contract" opened a preview that can only ever say "Failed to load contract
// template", because a WebView page's own fetches cannot inherit the app's per-request
// Bearer and the in-app browser carries no cookie.
//
// Now it loads /embed/underwriting/<token> — the same ReviewClient, chrome-less — inside
// a native shell that supplies the actions itself. Using the same web component rather
// than rebuilding the report natively keeps every token-authed control working (comp
// ARV/CMV toggles, misc-rehab, manager decision, Report an issue) and keeps the
// manager-presence ping that flips the report to "Under Review".

// Statuses whose report can be listed — mirrors the server publish gate.
const LISTABLE = ['pending_review', 'under_review', 'approved'];

// The website's in-report "Push to Marketplace" CTA. Suppressed in the embed, but the
// intercept is kept: it costs three lines, cannot misfire, and it is the correct
// behaviour on the legacy fallback path below.
const WEB_PREPARE_RE = /\/buyer-reports\/([0-9a-fA-F-]{36})\/prepare/;

const usd = (c?: number | null) => (c == null ? '—' : '$' + Math.round(c / 100).toLocaleString());

export default function UnderwritingDetail() {
  const params = useLocalSearchParams<{ id: string; token?: string; address?: string; status?: string; posted?: string }>();
  const id = String(params.id ?? '');
  const token = params.token ? String(params.token) : '';
  const router = useRouter();
  const webRef = useRef<WebView | null>(null);

  const [row, setRow] = useState<AnalysisRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  // If the embed route is not deployed yet, fall back to the full page rather than show
  // a blank screen. Cheap insurance against web/app deploy ordering.
  const [fallback, setFallback] = useState(false);

  // Re-fetch on focus. The route params are a first-paint hint only: previously the
  // action bar read the FROZEN params, so a report that finished while the screen was
  // open never grew its Push button until you backed out and came in again.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    if (!token) { setLoaded(true); return; }
    getAnalysisByToken(token)
      .then(r => { if (!cancelled) setRow(r); })
      .catch(() => { /* keep whatever we had; the embed still renders */ })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [token]));

  const status = row?.status ?? String(params.status ?? '');
  const address = row?.property_address || String(params.address ?? '');
  const isListable = LISTABLE.includes(status);
  const alreadyPosted = row?.buyer_share_enabled ?? params.posted === '1';

  const openPrepare = (analysisId: string = id) =>
    router.push({ pathname: '/underwriting/prepare/[id]', params: { id: analysisId, address } });

  // Everything the WebView must NOT be allowed to navigate to itself.
  const onIntercept = (url: string) => {
    const prep = url.match(WEB_PREPARE_RE);
    if (prep) { openPrepare(prep[1]); return true; }

    if (url.includes('/contracts/preview') || url.includes('/contracts/draft')) {
      Alert.alert('Contracts', 'Contract prep is on the web app for now.');
      return true;
    }
    // These are the links that produced Ryan's login screen. Swallow them — do NOT
    // hand them to the in-app browser, which can only show a login form.
    if (/^https?:\/\/[^/]+\/(dashboard|login|signup)(\/|\?|$)/.test(url)
        || url === `${API_BASE}/` ) {
      return true;
    }
    return false;
  };

  if (!loaded) return <Loading label="Loading report…" />;

  // A run that is still going belongs in the progress sheet, not here. `replace` so Back
  // doesn't ping-pong between the two.
  if (status === 'processing' || status === 'queued') {
    return (
      <View style={styles.wrap}>
        <Stack.Screen options={{ title: 'Underwriting' }} />
        <View style={styles.center}>
          <Text style={styles.centerTitle}>Still running</Text>
          <Text style={styles.centerBody} numberOfLines={3}>{address}</Text>
          <Button
            title="See progress"
            onPress={() => router.replace({ pathname: '/underwriting/progress/[id]', params: { id } })}
            style={{ marginTop: space.lg }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: address ? address.split(',')[0] : 'Underwriting' }} />

      {/* Native header strip. The web report's own sticky header is suppressed in the
          embed (it carries the broken Dashboard links and would just duplicate this),
          so these numbers have to live here or they are a real loss on a long scroll. */}
      {row ? (
        <View style={styles.strip}>
          <Text style={styles.addr} numberOfLines={1}>{address}</Text>
          <View style={styles.metrics}>
            <Metric label="Cash MAO" value={usd(row.cash_mao_cents)} tint={colors.lime} />
            <Metric label="Novation" value={usd(row.novation_mao_cents)} tint={colors.blue} />
            <Metric label="ARV" value={usd(row.arv_cents)} />
            <Metric label="Rehab" value={usd(row.rehab_total_cents)} tint={colors.warn} />
          </View>
        </View>
      ) : null}

      <EmbeddedReport
        mode="fill"
        path={fallback ? `/underwriting/${encodeURIComponent(token)}` : embedReportPath(token)}
        webRef={webRef}
        onIntercept={onIntercept}
        onHttpError={(s) => { if (s === 404 && !fallback) setFallback(true); }}
      />

      {isListable ? (
        <View style={styles.actions}>
          <Button
            title={alreadyPosted ? '🚀 Update Marketplace listing' : '🚀 Push to Marketplace'}
            variant="accent"
            onPress={() => openPrepare()}
          />
        </View>
      ) : null}
    </View>
  );
}

function Metric({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tint ? { color: tint } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  centerTitle: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  centerBody: { color: colors.textDim, fontSize: font.small, marginTop: space.sm, textAlign: 'center' },
  strip: {
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  addr: { color: colors.text, fontSize: font.small, fontWeight: '700', marginBottom: space.sm },
  metrics: { flexDirection: 'row', gap: space.md },
  metric: { flex: 1, minWidth: 0 },
  metricLabel: { color: colors.textFaint, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { color: colors.text, fontSize: font.small, fontWeight: '800', marginTop: 1 },
  actions: {
    padding: space.lg, paddingTop: space.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
});
