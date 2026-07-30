import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '@/components/ui';
import { reportUrl } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { colors, space, font } from '@/lib/theme';

// Underwriting detail — the owner's full report in a WebView (the canonical
// /underwriting/<access_token> page, which itself renders live progress while the
// run is in flight, then the full report), plus "Push to Marketplace" which opens
// the NATIVE prepare screen.
//
// Listing always goes through the prepare screen (Ryan 2026-07-29). Two things
// this replaced:
//  • The report page's own "Push to Marketplace" CTA is a link to the WEBSITE
//    prepare page, which isn't mobile-optimized — onNav intercepts it and pushes
//    the native screen instead.
//  • The old one-tap publish here posted an empty payload, which wiped prepared
//    listing copy and could never actually create a listing (no ask price).

// Statuses whose report can be listed — matches the server publish gate
// (buildSnapshotFromAnalysis). A pre-estimate carries no verified report.
const LISTABLE = ['pending_review', 'under_review', 'approved'];

// The website prepare URL the in-report CTA points at: /buyer-reports/<id>/prepare
const WEB_PREPARE_RE = /\/buyer-reports\/([0-9a-fA-F-]{36})\/prepare/;

export default function UnderwritingDetail() {
  const params = useLocalSearchParams<{ id: string; token?: string; address?: string; status?: string; posted?: string }>();
  const id = String(params.id);
  const token = params.token ? String(params.token) : '';
  const status = params.status ? String(params.status) : '';
  const router = useRouter();
  const posted = params.posted === '1';
  const [loading, setLoading] = useState(true);

  const isListable = LISTABLE.includes(status);

  const openPrepare = (analysisId: string = id) =>
    router.push({
      pathname: '/underwriting/prepare/[id]',
      params: { id: analysisId, address: params.address ?? '' },
    });

  const uri = token ? reportUrl(token) : `${API_BASE}/underwriting`;

  // Keep the report in the WebView; send real external links (a comp's Zillow
  // source, etc.) to the in-app browser. The report's own "Push to Marketplace"
  // CTA targets the website prepare page — intercept it and open the native
  // prepare screen, which is built for the phone.
  const onNav = (req: { url: string }) => {
    const prep = req.url.match(WEB_PREPARE_RE);
    if (prep) { openPrepare(prep[1]); return false; }
    if (req.url === uri || req.url.startsWith(`${API_BASE}/underwriting/`)) return true;
    if (/^(data|blob|about):/.test(req.url)) return true;
    if (/^https?:/.test(req.url)) { WebBrowser.openBrowserAsync(req.url).catch(() => {}); return false; }
    return true;
  };

  return (
    <View style={styles.wrap}>
      {token ? (
        <WebView
          source={{ uri }}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onNav}
          onLoadEnd={() => setLoading(false)}
          style={styles.web}
          containerStyle={styles.web}
        />
      ) : (
        <View style={styles.center}><Text style={styles.dim}>This report isn’t available to view yet.</Text></View>
      )}
      {loading && token ? (
        <View style={styles.loading} pointerEvents="none"><ActivityIndicator color={colors.blue} /></View>
      ) : null}

      {isListable ? (
        <View style={styles.bar}>
          <Button
            title={posted ? '🚀 Update Marketplace listing' : '🚀 Push to Marketplace'}
            variant={posted ? 'accent' : 'primary'}
            onPress={() => openPrepare()}
          />
          <Text style={styles.hint}>
            {posted
              ? 'Live on the Marketplace — edit the photos and listing details.'
              : 'Add photos and listing details, then publish and share the buyer link.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dim: { color: colors.textDim, fontSize: font.body, textAlign: 'center' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  bar: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: space.lg },
  hint: { color: colors.textFaint, fontSize: font.small, textAlign: 'center', marginTop: space.sm },
});
