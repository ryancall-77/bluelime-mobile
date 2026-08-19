// In-flight underwriting runs — the state behind the top banner.
//
// Why this exists: submitting a report used to `router.replace` onto a WebView of the
// website's progress page, which destroyed the back entry and trapped the user on a
// screen with nothing else to do (Ryan, on device, 2026-08-19). A run is now tracked
// here, surfaced as a banner above the whole navigator, and the user goes wherever they
// like while it runs.
//
// Follows the AuthProvider pattern in ./auth.tsx: inert no-op context defaults (never
// undefined + throw), provider component, `use*` hook exported at the bottom.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getRunStatuses } from './api';
import { useAuth } from './auth';
import { phaseOf, type RunPhase } from './uwStages';

export interface TrackedRun {
  id: string;
  access_token: string;
  address: string;
  submitted_at: string;
  status: string;
  processing_stage: string | null;
  processing_error: string | null;
  queue_reason: string | null;
  processing_started_at: string | null;
  buyer_share_enabled: boolean | null;
  stage_seen_at: number;              // local ms — when this stage was FIRST observed
  dismissed_phase: RunPhase | null;   // banner hidden for this phase only
  stalled: boolean;
  timeline: { at: string; stage: string }[] | null;
}

interface RunsState {
  runs: TrackedRun[];
  banner: TrackedRun | null;
  extraCount: number;
  track: (seed: { id: string; access_token: string; address: string; status?: string }) => void;
  dismiss: (id: string) => void;
  getRun: (id: string) => TrackedRun | null;
  refreshNow: () => Promise<void>;
}

const Ctx = createContext<RunsState>({
  runs: [], banner: null, extraCount: 0,
  track: () => {}, dismiss: () => {}, getRun: () => null, refreshNow: async () => {},
});

// A run older than this has almost certainly died in a way we will not see; stop
// polling and let the banner say so rather than spinning forever. p90 is ~6 minutes.
const STALL_AFTER_MS = 45 * 60 * 1000;

function pollIntervalFor(oldestActiveAgeMs: number): number | null {
  if (oldestActiveAgeMs >= STALL_AFTER_MS) return null;
  if (oldestActiveAgeMs < 10 * 60 * 1000) return 5000;   // matches the web report's own poll
  if (oldestActiveAgeMs < 20 * 60 * 1000) return 15000;
  return 30000;
}

const ACTIVE: RunPhase[] = ['queued', 'processing'];
// Which run the single banner represents when several are in flight. `ready` outranks
// `failed` because a finished report is the dominant outcome and the thing the user is
// actually waiting on; failures stay reachable through the +N pill.
const PRIORITY: RunPhase[] = ['ready', 'failed', 'blocked', 'pre_estimate', 'queued', 'processing'];

export function RunsProvider({ children }: { children: React.ReactNode }) {
  const { signedIn } = useAuth();
  const [runs, setRuns] = useState<TrackedRun[]>([]);
  const runsRef = useRef<TrackedRun[]>([]);
  runsRef.current = runs;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [appActive, setAppActive] = useState(true);

  const track = useCallback((seed: { id: string; access_token: string; address: string; status?: string }) => {
    if (!seed.id) return;
    setRuns(prev => {
      if (prev.some(r => r.id === seed.id)) return prev;
      return [{
        id: seed.id,
        access_token: seed.access_token,
        address: seed.address,
        submitted_at: new Date().toISOString(),
        status: seed.status ?? 'processing',
        processing_stage: null,
        processing_error: null,
        queue_reason: null,
        processing_started_at: null,
        buyer_share_enabled: null,
        stage_seen_at: Date.now(),
        dismissed_phase: null,
        stalled: false,
        timeline: null,
      }, ...prev];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setRuns(prev => prev.map(r =>
      r.id === id ? { ...r, dismissed_phase: phaseOf(r.status) } : r));
  }, []);

  const refreshNow = useCallback(async () => {
    const current = runsRef.current;
    const active = current.filter(r => ACTIVE.includes(phaseOf(r.status)) && !r.stalled);
    if (active.length === 0) return;
    const ids = active.slice(0, 10).map(r => r.id);
    try {
      const { analyses } = await getRunStatuses(ids);
      const byId = new Map(analyses.map(a => [a.id, a]));
      setRuns(prev => prev.map(r => {
        const a = byId.get(r.id);
        if (!a) return r;
        const stageChanged = a.processing_stage !== r.processing_stage;
        const phaseChanged = phaseOf(a.status) !== phaseOf(r.status);
        return {
          ...r,
          status: a.status,
          processing_stage: a.processing_stage,
          processing_error: a.processing_error,
          queue_reason: a.queue_reason,
          processing_started_at: a.processing_started_at,
          buyer_share_enabled: a.buyer_share_enabled,
          access_token: a.access_token || r.access_token,
          address: r.address || a.property_address || '',
          stage_seen_at: stageChanged ? Date.now() : r.stage_seen_at,
          // A phase change un-dismisses: someone who hid "running" still wants to know
          // it is ready.
          dismissed_phase: phaseChanged ? null : r.dismissed_phase,
          timeline: a.processing_timeline ?? r.timeline,
        };
      }));
    } catch {
      // A failed poll is not news — the next tick retries. Never surface it.
    }
  }, []);

  // iOS suspends JS timers when backgrounded, and supabase's auto-refresh is stopped
  // there too — so a live interval would just discharge a burst of possibly-401 requests
  // on resume. Stop on background, fire once immediately on return, then restart.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      const active = s === 'active';
      setAppActive(active);
      if (active) void refreshNow();
    });
    return () => sub.remove();
  }, [refreshNow]);

  useEffect(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (!signedIn || !appActive) return;

    const active = runs.filter(r => ACTIVE.includes(phaseOf(r.status)) && !r.stalled);
    if (active.length === 0) return;

    const oldestAge = Math.max(...active.map(r =>
      Date.now() - new Date(r.processing_started_at || r.submitted_at).getTime()));

    const ms = pollIntervalFor(oldestAge);
    if (ms == null) {
      setRuns(prev => prev.map(r =>
        ACTIVE.includes(phaseOf(r.status)) && !r.stalled ? { ...r, stalled: true } : r));
      return;
    }
    timer.current = setInterval(() => { void refreshNow(); }, ms);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [signedIn, appActive, runs, refreshNow]);

  const visible = runs.filter(r => r.dismissed_phase !== phaseOf(r.status));
  const banner = visible.length === 0 ? null : [...visible].sort((a, b) => {
    const d = PRIORITY.indexOf(phaseOf(a.status)) - PRIORITY.indexOf(phaseOf(b.status));
    return d !== 0 ? d : new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
  })[0];

  const getRun = useCallback((id: string) => runsRef.current.find(r => r.id === id) ?? null, []);

  return (
    <Ctx.Provider value={{
      runs, banner, extraCount: Math.max(0, visible.length - 1),
      track, dismiss, getRun, refreshNow,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useRuns = () => useContext(Ctx);
