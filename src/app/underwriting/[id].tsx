import React, { useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '@/components/ui';
import { postToMarketplace, reportUrl } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { colors, space, font } from '@/lib/theme';

// Underwriting detail — the owner's full report in a WebView (the canonical
// /underwriting/<access_token> page, which itself renders live progress while the
// run is in flight, then the full report), plus a one-tap "Post to Bluelime
// Marketplace" that publishes and hands back the public buyer link to share.

const READY = ['pending_review', 'under_review', 'approved', 'complete', 'pre_estimate_complete'];

export default function UnderwritingDetail() {
  const params = useLocalSearchParams<{ id: string; token?: string; address?: string; status?: string; posted?: string }>();
  const id = String(params.id);
  const token = params.token ? String(params.token) : '';
  const status = params.status ? String(params.status) : '';
  const [posted, setPosted] = useState(params.posted === '1');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const isReady = READY.includes(status);

  const share = async (buyerUrl: string) => {
    try {
      await Share.share({
        message: `${params.address ? params.address + ' — ' : ''}View this deal on Bluelime: ${buyerUrl}`,
        url: buyerUrl,
      });
    } catch { /* user cancelled */ }
  };

  const onPost = async () => {
    if (!isReady) {
      Alert.alert('Not ready yet', 'You can post to the Marketplace once the underwriting has finished running.');
      return;
    }
    setBusy(true);
    try {
      const res = await postToMarketplace(id);
      setPosted(true);
      await share(res.buyer_url);
    } catch (e) {
      Alert.alert('Could not post', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const uri = token ? reportUrl(token) : `${API_BASE}/underwriting`;

  // Let comp source links / external links open in the in-app browser rather than
  // hijacking the report WebView.
  const onNav = (req: { url: string }) => {
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

      <View style={styles.bar}>
        {posted ? (
          <Button title="Share buyer link" variant="accent" loading={busy} onPress={onPost} />
        ) : (
          <Button title="Post to Bluelime Marketplace" loading={busy} onPress={onPost} />
        )}
        <Text style={styles.hint}>
          {posted
            ? 'Live on the Marketplace — tap to re-share the buyer link.'
            : isReady
              ? 'Publishes a buyer-facing report and gives you a link to text your buyers.'
              : 'Available once the underwriting finishes.'}
        </Text>
      </View>
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
