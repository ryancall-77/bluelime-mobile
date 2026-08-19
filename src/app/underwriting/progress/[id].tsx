import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { useRuns } from '@/lib/runs';
import { STAGES, phaseOf, stageLabel, stageProgress } from '@/lib/uwStages';
import { colors, font, radius, space } from '@/lib/theme';

// Live progress for one run. A MODAL, so closing it returns the user to exactly the
// screen they opened it from — the whole point of this change is that a running report
// never takes the app away from you.
//
// Native rather than a WebView of the website's progress page for two reasons: that page
// early-returns a 100vh layout before its `embedded` branch (the measured-WebView
// ratchet Ryan hit on device), and a native sheet can show elapsed time, per-step
// timestamps and the queue reason, none of which the web step list carries.
//
// It reads useRuns() and starts no poll of its own — the provider is already polling.
export default function RunProgress() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getRun, refreshNow } = useRuns();
  const run = getRun(String(id));

  // Tick so elapsed time and the weighted bar move between polls.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { void refreshNow(); }, [refreshNow]);

  if (!run) {
    return (
      <View style={styles.wrap}>
        <View style={styles.center}>
          <Text style={styles.dim}>This run is no longer being tracked.</Text>
          <Button title="Close" onPress={() => router.back()} style={{ marginTop: space.lg }} />
        </View>
      </View>
    );
  }

  const phase = phaseOf(run.status);
  const done = phase === 'ready' || phase === 'pre_estimate';
  const startedMs = new Date(run.processing_started_at || run.submitted_at).getTime();
  const elapsed = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
  const mmss = `${Math.floor(elapsed / 60)}m ${String(elapsed % 60).padStart(2, '0')}s`;

  const currentIdx = STAGES.findIndex(s => s.key === run.processing_stage);
  const pct = stageProgress(run.processing_stage, run.stage_seen_at, Date.now());

  // Per-step timestamps ride along on single-id polls.
  const stampFor = (key: string) => {
    const hit = (run.timeline ?? []).find(t => t.stage === key);
    if (!hit) return null;
    const d = new Date(hit.at);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.addr} numberOfLines={2}>{run.address || 'Your report'}</Text>

        {phase === 'queued' ? (
          <View style={[styles.notice, { borderColor: colors.warn }]}>
            <Text style={[styles.noticeTitle, { color: colors.warn }]}>Queued</Text>
            <Text style={styles.noticeBody}>
              No underwriting browser is online right now. Your report is saved and will run
              automatically the moment one comes up — you don&apos;t need to resubmit.
              {run.queue_reason ? `\n\n(${run.queue_reason})` : ''}
            </Text>
          </View>
        ) : null}

        {phase === 'failed' ? (
          <View style={[styles.notice, { borderColor: colors.danger }]}>
            <Text style={[styles.noticeTitle, { color: colors.danger }]}>Report failed</Text>
            <Text style={styles.noticeBody}>{run.processing_error || 'No reason was recorded.'}</Text>
          </View>
        ) : null}

        {run.stalled ? (
          <View style={[styles.notice, { borderColor: colors.warn }]}>
            <Text style={[styles.noticeTitle, { color: colors.warn }]}>Taking longer than usual</Text>
            <Text style={styles.noticeBody}>
              We&apos;ve stopped checking automatically. Pull the status again below, or open
              the report to see where it got to.
            </Text>
            <Button title="Check again" variant="outline" onPress={() => { void refreshNow(); }} style={{ marginTop: space.md }} />
          </View>
        ) : null}

        {phase === 'processing' ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={styles.elapsed}>{stageLabel(run.processing_stage)} · {mmss} elapsed</Text>
          </>
        ) : null}

        <View style={styles.steps}>
          {STAGES.map((s, i) => {
            const isDone = done || (currentIdx >= 0 && i < currentIdx);
            const isNow = !done && i === currentIdx;
            const stamp = stampFor(s.key);
            return (
              <View key={s.key} style={styles.step}>
                <Text style={[
                  styles.bullet,
                  isDone && { color: colors.lime },
                  isNow && { color: colors.blue },
                ]}>
                  {isDone ? '●' : isNow ? '◐' : '○'}
                </Text>
                <Text style={[
                  styles.stepText,
                  isDone && { color: colors.textDim },
                  isNow && { color: colors.text, fontWeight: '700' },
                ]} numberOfLines={1}>
                  {s.label}
                </Text>
                {stamp ? <Text style={styles.stamp}>{stamp}</Text> : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.foot}>
          You can close this and keep using the app — the bar at the top keeps tracking it,
          and we&apos;ll tell you the moment it&apos;s ready.
        </Text>

        {done ? (
          <Button
            title="View report →"
            variant="accent"
            onPress={() => router.replace({
              pathname: '/underwriting/[id]',
              params: { id: run.id, token: run.access_token, address: run.address },
            })}
            style={{ marginTop: space.lg }}
          />
        ) : null}

        <Pressable onPress={() => router.back()} style={styles.closeRow} accessibilityRole="button">
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dim: { color: colors.textFaint, fontSize: font.body, textAlign: 'center' },
  addr: { color: colors.text, fontSize: font.h3, fontWeight: '800', marginBottom: space.lg },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.lg, backgroundColor: colors.surface },
  noticeTitle: { fontSize: font.small, fontWeight: '800', marginBottom: 4 },
  noticeBody: { color: colors.textDim, fontSize: font.small, lineHeight: 19 },
  track: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.blue },
  elapsed: { color: colors.textDim, fontSize: font.small, marginTop: space.sm, marginBottom: space.lg },
  steps: { gap: space.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bullet: { color: colors.textFaint, fontSize: 13, width: 16 },
  stepText: { color: colors.textFaint, fontSize: font.small, flex: 1 },
  stamp: { color: colors.textFaint, fontSize: font.tiny },
  foot: { color: colors.textFaint, fontSize: font.small, lineHeight: 19, marginTop: space.xl },
  closeRow: { alignSelf: 'center', paddingVertical: space.lg, paddingHorizontal: space.xl },
  closeText: { color: colors.blue, fontSize: font.body, fontWeight: '700' },
});
