import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '@/lib/theme';
import { phaseOf, stageLabel, stageProgress } from '@/lib/uwStages';
import type { TrackedRun } from '@/lib/runs';

// The in-flight report banner. Mounted ONCE, above the navigator, so it appears on every
// tab and every stack screen.
//
// It is a plain flex child in a column — never position:'absolute', never zIndex. Ryan
// asked for it to "push the top of the app down", and a flex sibling does that by
// construction; an overlay would sit on top of the TopBar instead.
//
// It also owns the top safe-area inset while it is visible: the navigator below is
// wrapped in a nested SafeAreaProvider that then reports top = 0, so TopBar and every
// <Screen edges={['top']}> stop padding for a status bar the banner is already covering.
// That is what stops the ~47pt double-gap this codebase has hit before.

export function RunBanner({
  run, extraCount, topInset, onPress, onDismiss,
}: {
  run: TrackedRun;
  extraCount: number;
  topInset: number;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const phase = phaseOf(run.status);

  // Re-render on a slow tick so the progress bar creeps between polls instead of
  // freezing until the next status arrives.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (phase !== 'processing') return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const address = run.address || 'Your report';

  let tint = colors.blue;
  let title = 'Running underwriting';
  let detail = stageLabel(run.processing_stage);
  let showSpinner = true;

  if (run.stalled) {
    tint = colors.warn;
    title = 'Taking longer than usual';
    detail = 'Tap to check';
    showSpinner = false;
  } else if (phase === 'ready' || phase === 'pre_estimate') {
    tint = colors.lime;
    title = phase === 'pre_estimate' ? 'Estimate ready' : 'Report ready';
    detail = 'Tap to view';
    showSpinner = false;
  } else if (phase === 'failed') {
    tint = colors.danger;
    title = 'Report failed';
    detail = run.processing_error ? String(run.processing_error).slice(0, 60) : 'Tap for details';
    showSpinner = false;
  } else if (phase === 'blocked') {
    tint = colors.warn;
    title = 'Needs a browser';
    detail = 'Tap for details';
    showSpinner = false;
  } else if (phase === 'queued') {
    tint = colors.warn;
    title = 'Queued';
    detail = 'Waiting for an agent to come online';
    showSpinner = false;
  }

  const pct = phase === 'processing' && !run.stalled
    ? stageProgress(run.processing_stage, run.stage_seen_at, Date.now())
    : null;

  return (
    <View style={[styles.wrap, { paddingTop: topInset, borderBottomColor: tint }]}>
      <Pressable
        onPress={onPress}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${title} — ${address}. ${detail}`}
      >
        {showSpinner
          ? <ActivityIndicator size="small" color={tint} style={styles.icon} />
          : <View style={[styles.dot, { backgroundColor: tint }]} />}

        <View style={styles.text}>
          <Text style={[styles.title, { color: tint }]} numberOfLines={1}>
            {title}
            {extraCount > 0 ? <Text style={styles.more}>  +{extraCount}</Text> : null}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {address} · {detail}
          </Text>
        </View>

        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Hide this banner"
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </Pressable>

      {pct != null ? (
        <View style={styles.trackWrap}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: tint }]} />
          </View>
          <Text style={[styles.pctText, { color: tint }]}>{Math.round(pct * 100)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, height: 46, gap: space.sm },
  icon: { width: 18 },
  dot: { width: 9, height: 9, borderRadius: 5, marginHorizontal: 4 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: font.small, fontWeight: '700' },
  more: { color: colors.textFaint, fontWeight: '600' },
  detail: { color: colors.textDim, fontSize: font.tiny, marginTop: 1 },
  close: { paddingHorizontal: 4, paddingVertical: 4 },
  closeText: { color: colors.textFaint, fontSize: 15, fontWeight: '600' },
  // Deliberately chunky. At 3px on a dark ground the old bar was invisible unless you
  // went looking for it (Ryan, 2026-08-19); the percentage next to it removes any doubt
  // that something is actually moving.
  trackWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, paddingBottom: space.sm,
  },
  track: {
    flex: 1, height: 8, borderRadius: 4, overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  fill: { height: 8, borderRadius: 4 },
  pctText: { fontSize: font.tiny, fontWeight: '800', minWidth: 34, textAlign: 'right' },
});
