import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE } from '@/lib/config';
import { colors } from '@/lib/theme';
import { PhotoViewer, type PhotoViewerState } from './PhotoViewer';

// Renders THE canonical web underwriting report (comps w/ multiple photos +
// click-to-enlarge, adjustments, condition grid, expand-all) inline, by loading
// the chrome-less /embed/deal-report/[id] route in a WebView. The app paints the
// hero/photos/flip-boxes/actions natively above this; this is the exact web
// report below them, so it can never drift from bluelime.ai.
//
// Sizing: the embed page has no scroll of its own (scrollEnabled=false) — it
// reports its content height back over postMessage and we grow the WebView to
// match, so the OUTER native ScrollView owns the scroll (no nested-scroll
// conflict). A ResizeObserver re-reports height when the user expands a comp.

// Reports the document height now, and whenever it changes (expand-all, images
// finishing load, lightbox open/close). Kept resilient with a few timed nudges.
const HEIGHT_JS = `
(function () {
  function h() {
    return Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    );
  }
  function post() {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(String(h()));
  }
  post();
  try { new ResizeObserver(post).observe(document.body); } catch (e) {}
  try {
    new MutationObserver(post).observe(document.body, { subtree: true, childList: true, attributes: true });
  } catch (e) {}
  window.addEventListener('load', post);
  [150, 400, 900, 1800, 3200].forEach(function (t) { setTimeout(post, t); });
})();
true;
`;

export function EmbeddedReport({ dealId }: { dealId: string }) {
  const uri = `${API_BASE}/embed/deal-report/${encodeURIComponent(dealId)}`;
  const [height, setHeight] = useState(560);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<PhotoViewerState | null>(null);
  const settled = useRef(false);

  // Two kinds of message: a bare NUMBER (content height, see HEIGHT_JS) and a JSON
  // envelope. The report posts {type:'bluelime:photos'} instead of opening its own
  // lightbox in the app — a `position: fixed` overlay is unusable in this WebView
  // because the viewport is the whole document height, so the image landed far
  // off-screen and only the black backdrop showed.
  const onMessage = (e: WebViewMessageEvent) => {
    const raw = e.nativeEvent.data;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 120) {
      settled.current = true;
      setHeight(Math.ceil(n));
      return;
    }
    try {
      const msg = JSON.parse(raw) as { type?: string; urls?: unknown; index?: unknown };
      if (msg?.type === 'bluelime:photos' && Array.isArray(msg.urls)) {
        const urls = msg.urls.filter((u): u is string => typeof u === 'string');
        if (urls.length) {
          setViewer({ urls, index: Number.isFinite(Number(msg.index)) ? Number(msg.index) : 0 });
        }
      }
    } catch { /* not JSON — nothing else to handle */ }
  };

  // Keep the report itself in the WebView; send any real navigation (a comp's
  // "Zillow" source link, "Make an Offer", etc.) to the in-app browser instead
  // of hijacking the embedded frame. Subresources (images/CSS) are not gated
  // here, so comp photos still load normally.
  const onNav = (req: { url: string; navigationType?: string }) => {
    if (req.url === uri || req.url.startsWith(`${API_BASE}/embed/`)) return true;
    if (/^(data|blob|about):/.test(req.url)) return true;
    if (/^https?:/.test(req.url)) {
      WebBrowser.openBrowserAsync(req.url).catch(() => {});
      return false;
    }
    return false;
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        source={{ uri }}
        originWhitelist={['*']}
        injectedJavaScript={HEIGHT_JS}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onNav}
        onLoadEnd={() => setLoading(false)}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        showsVerticalScrollIndicator={false}
        // Dark base (via style) so there's no white flash before the report paints.
        style={styles.web}
        containerStyle={styles.web}
      />
      {loading && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.blue} />
        </View>
      )}
      <PhotoViewer state={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
  loading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg,
  },
});
