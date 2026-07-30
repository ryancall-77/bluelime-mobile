import React, { useState } from 'react';
import {
  Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, font, radius, space } from '@/lib/theme';

// Native full-screen photo viewer with pinch-to-zoom.
//
// Why native: the web report's lightbox is a `position: fixed` overlay, which
// breaks inside the embedded report WebView — that WebView doesn't scroll (the
// native ScrollView owns scrolling) so its viewport is the FULL document height,
// and the overlay centred the image thousands of pixels below the screen. All the
// user saw was the black backdrop. The report now posts the photo list to the app
// and this takes over, which also gets us pinch-zoom for free.

export interface PhotoViewerState { urls: string[]; index: number }

export function PhotoViewer({
  state, onClose,
}: { state: PhotoViewerState | null; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  // Re-seed when a new set is opened.
  const [seededFor, setSeededFor] = useState<PhotoViewerState | null>(null);
  if (state && state !== seededFor) {
    setSeededFor(state);
    setIdx(Math.min(Math.max(0, state.index), Math.max(0, state.urls.length - 1)));
  }

  if (!state || state.urls.length === 0) return null;
  const { width, height } = Dimensions.get('window');
  const url = state.urls[Math.min(idx, state.urls.length - 1)];
  const many = state.urls.length > 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {/* Pinch-to-zoom: a ScrollView with zoom scales is the RN-native way. */}
        <ScrollView
          style={styles.zoomer}
          contentContainerStyle={{ width, height }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={{ width, height }} onPress={onClose}>
            <Image
              source={{ uri: url }}
              style={{ width, height }}
              contentFit="contain"
              transition={120}
            />
          </Pressable>
        </ScrollView>

        <View style={styles.topBar} pointerEvents="box-none">
          {many ? <Text style={styles.counter}>{idx + 1} / {state.urls.length}</Text> : <View />}
          <Pressable onPress={onClose} hitSlop={14} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {many ? (
          <View style={styles.nav} pointerEvents="box-none">
            <Pressable
              onPress={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              hitSlop={12}
              style={[styles.navBtn, idx === 0 && styles.navDisabled]}
            >
              <Text style={styles.navText}>‹</Text>
            </Pressable>
            <Pressable
              onPress={() => setIdx((i) => Math.min(state.urls.length - 1, i + 1))}
              disabled={idx >= state.urls.length - 1}
              hitSlop={12}
              style={[styles.navBtn, idx >= state.urls.length - 1 && styles.navDisabled]}
            >
              <Text style={styles.navText}>›</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.hint}>Pinch to zoom · tap the photo to close</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  zoomer: { flex: 1 },
  topBar: {
    position: 'absolute', top: 44, left: space.lg, right: space.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  counter: { color: 'rgba(255,255,255,0.8)', fontSize: font.small, fontWeight: '700' },
  closeBtn: {
    width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  closeText: { color: colors.white, fontSize: 17, fontWeight: '600' },
  nav: {
    position: 'absolute', top: 0, bottom: 0, left: space.sm, right: space.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  navBtn: {
    width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  navDisabled: { opacity: 0.25 },
  navText: { color: colors.white, fontSize: 26, fontWeight: '400', marginTop: -3 },
  hint: {
    position: 'absolute', bottom: 36, left: 0, right: 0, textAlign: 'center',
    color: 'rgba(255,255,255,0.55)', fontSize: font.small,
  },
});
