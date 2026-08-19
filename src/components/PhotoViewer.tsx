import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, font, radius, space } from '@/lib/theme';

// Native full-screen photo viewer: swipe between photos, pinch to zoom, and a rotate
// control for landscape shots.
//
// Why native at all: the web report's lightbox is a `position: fixed` overlay, which
// breaks inside the report WebView — the WebView's viewport is the full document height,
// so the overlay centred the image thousands of pixels below the screen and all the user
// saw was a black backdrop. The report posts its photo list to the app instead and this
// takes over. Every photo surface in the app funnels through here — the deal hero
// gallery, the report's subject photos, and comp photos inside the WebView — so they all
// behave identically, which is what Ryan asked for.
//
// Structure: an outer horizontal paging ScrollView (one page per photo) with a per-page
// zoomable ScrollView inside it. iOS resolves the gesture conflict itself — at zoom 1 the
// outer pager wins the horizontal pan, and once zoomed the inner view keeps it so you can
// pan around a magnified photo without changing page.
//
// ROTATION CAVEAT: the app is orientation-locked to portrait in app.json, which becomes a
// native iOS UISupportedInterfaceOrientations lock — no JS can override it, and unlocking
// per-screen needs expo-screen-orientation, a native module. Both are native changes that
// force a new EAS build. The ⟳ button is the JS-only equivalent: it rotates the photo 90°
// and refits it, so a landscape shot uses the full long edge of the screen while the
// device stays portrait.

export interface PhotoViewerState { urls: string[]; index: number }

export function PhotoViewer({
  state, onClose,
}: { state: PhotoViewerState | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [idx, setIdx] = useState(0);
  const [rotated, setRotated] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const pager = useRef<ScrollView | null>(null);
  const [seededFor, setSeededFor] = useState<PhotoViewerState | null>(null);

  const urls = state?.urls ?? [];
  const start = state ? Math.min(Math.max(0, state.index), Math.max(0, urls.length - 1)) : 0;

  // Re-seed when a new set is opened.
  if (state && state !== seededFor) {
    setSeededFor(state);
    setIdx(start);
    setRotated(false);
    setZoomed(false);
  }

  // Jump the pager to the tapped photo. After layout, so the offset is honoured.
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => {
      pager.current?.scrollTo({ x: start * width, y: 0, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [state, start, width]);

  if (!state || urls.length === 0) return null;
  const many = urls.length > 1;

  const onPageEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== idx) {
      setIdx(next);
      setRotated(false);   // a new photo starts upright
      setZoomed(false);
    }
  };

  // Rotated: the image element is laid out landscape (height x width) and then turned 90°,
  // so its bounding box comes back to the screen's portrait footprint while the photo
  // itself uses the long edge.
  const imgStyle = rotated
    ? { width: height, height: width, transform: [{ rotate: '90deg' as const }] }
    : { width, height };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          // Paging must be off while zoomed, or a pan inside a magnified photo flips the
          // page instead of moving the image.
          scrollEnabled={many && !zoomed}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPageEnd}
          style={styles.pager}
        >
          {urls.map((u, i) => (
            <ScrollView
              key={`${u}-${i}`}
              style={{ width, height }}
              contentContainerStyle={{ width, height, alignItems: 'center', justifyContent: 'center' }}
              maximumZoomScale={5}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                if (i !== idx) return;
                setZoomed((e.nativeEvent as unknown as { zoomScale?: number }).zoomScale != null
                  ? ((e.nativeEvent as unknown as { zoomScale: number }).zoomScale > 1.02)
                  : false);
              }}
              scrollEventThrottle={80}
            >
              <Pressable
                // Tap closes — but only at rest. Closing mid-pinch or mid-pan is the kind
                // of accidental dismissal that makes a viewer feel broken.
                onPress={() => { if (!zoomed) onClose(); }}
                style={{ width, height, alignItems: 'center', justifyContent: 'center' }}
              >
                <Image source={{ uri: u }} style={imgStyle} contentFit="contain" transition={120} />
              </Pressable>
            </ScrollView>
          ))}
        </ScrollView>

        <View style={styles.topBar} pointerEvents="box-none">
          {many ? <Text style={styles.counter}>{idx + 1} / {urls.length}</Text> : <View />}
          <View style={styles.topRight}>
            <Pressable onPress={() => setRotated(r => !r)} hitSlop={14} style={styles.iconBtn}
              accessibilityRole="button" accessibilityLabel="Rotate photo">
              <Text style={styles.iconText}>⟳</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={14} style={styles.iconBtn}
              accessibilityRole="button" accessibilityLabel="Close photo">
              <Text style={styles.iconText}>✕</Text>
            </Pressable>
          </View>
        </View>

        {/* Thumbnail strip — the affordance that makes "there are more photos" obvious
            rather than something the user has to discover by guessing. */}
        {many ? (
          <View style={styles.filmstripWrap} pointerEvents="box-none">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filmstrip}
            >
              {urls.map((u, i) => (
                <Pressable
                  key={`t-${u}-${i}`}
                  onPress={() => {
                    setIdx(i); setRotated(false); setZoomed(false);
                    pager.current?.scrollTo({ x: i * width, y: 0, animated: true });
                  }}
                  style={[styles.thumb, i === idx && styles.thumbOn]}
                >
                  <Image source={{ uri: u }} style={styles.thumbImg} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.hint}>Swipe to browse · pinch to zoom · ⟳ to rotate</Text>
          </View>
        ) : (
          <Text style={styles.hintAlone}>Pinch to zoom · ⟳ to rotate · tap to close</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  pager: { flex: 1 },
  topBar: {
    position: 'absolute', top: 44, left: space.lg, right: space.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topRight: { flexDirection: 'row', gap: space.sm },
  counter: { color: 'rgba(255,255,255,0.85)', fontSize: font.small, fontWeight: '700' },
  iconBtn: {
    width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  iconText: { color: colors.white, fontSize: 17, fontWeight: '600' },
  filmstripWrap: { position: 'absolute', bottom: 26, left: 0, right: 0 },
  filmstrip: { paddingHorizontal: space.lg, gap: space.sm, alignItems: 'center' },
  thumb: {
    width: 54, height: 40, borderRadius: 6, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent', opacity: 0.55,
  },
  thumbOn: { borderColor: colors.lime, opacity: 1 },
  thumbImg: { width: '100%', height: '100%' },
  hint: {
    textAlign: 'center', marginTop: space.sm,
    color: 'rgba(255,255,255,0.55)', fontSize: font.tiny,
  },
  hintAlone: {
    position: 'absolute', bottom: 36, left: 0, right: 0, textAlign: 'center',
    color: 'rgba(255,255,255,0.55)', fontSize: font.small,
  },
});
