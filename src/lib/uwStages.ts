// Underwriting run stages — the single source of truth for stage vocabulary in the app.
//
// The 10 steps below are copied verbatim from the WEB report's own progress list
// (app/src/app/underwriting/[token]/review-client.tsx). That is the only correct list in
// the codebase: the two admin/list `STAGE_LABELS` maps both omit `verifying_comps`,
// which occurs in the majority of real runs, and would render the raw slug at the user.

export type RunPhase = 'queued' | 'processing' | 'ready' | 'failed' | 'blocked' | 'pre_estimate';

// `weight` is median dwell in seconds. It is what drives the progress bar — NOT the step
// index. Five of the ten stages finish in 0-2s while three take 25-80s, so an
// index-driven bar jumps 1→2, stalls a minute, jumps to 4, stalls, jumps 7→8, stalls
// again. That reads as broken. Weighted time reads as moving.
export const STAGES: { key: string; label: string; weight: number }[] = [
  { key: 'fetching_rpr_subject',      label: 'Subject property lookup', weight: 2 },
  { key: 'fetching_subject_photos',   label: 'Subject photos',          weight: 60 },
  { key: 'scoring_subject_condition', label: 'Subject condition score', weight: 2 },
  { key: 'extracting',                label: 'AI rehab extraction',     weight: 30 },
  { key: 'fetching_comps',            label: 'Comparable properties',   weight: 2 },
  { key: 'fetching_rpr_comps',        label: 'Comp photos',             weight: 2 },
  { key: 'verifying_comps',           label: 'Verifying comp sales',    weight: 25 },
  { key: 'running_vision',            label: 'Comp photo analysis',     weight: 79 },
  { key: 'computing_maos',            label: 'Computing offers',        weight: 2 },
  { key: 'finalizing',                label: 'Finalizing report',       weight: 37 },
];

const TOTAL_WEIGHT = STAGES.reduce((n, s) => n + s.weight, 0);

// Stages that exist but are not steps on the ladder — they sit outside the 10.
const EXTRA_LABELS: Record<string, string> = {
  queued_for_agent: 'Waiting for a browser',
  incremental_rehab_extraction: 'Rehab re-extraction',
  incremental_mao_recalc: 'Recomputing offers',
  pre_estimate_finalizing: 'Finalizing (pre-estimate)',
};

export const STAGE_LABEL: Record<string, string> = {
  ...Object.fromEntries(STAGES.map(s => [s.key, s.label])),
  ...EXTRA_LABELS,
};

export function stageLabel(slug: string | null | undefined): string {
  if (!slug) return 'Working…';
  return STAGE_LABEL[slug] ?? slug.replace(/_/g, ' ');
}

export function phaseOf(status: string | null | undefined): RunPhase {
  switch (status) {
    case 'queued': return 'queued';
    case 'processing': return 'processing';
    case 'blocked_no_rpr': return 'blocked';
    case 'failed': return 'failed';
    case 'pre_estimate_complete': return 'pre_estimate';
    // Everything else — pending_review, under_review, approved, and any status added
    // later — is a finished report. This default is deliberately the OPPOSITE of the
    // usual "unknown value must not be treated as done" caution: an unrecognised status
    // treated as still-running leaves the banner spinning and the poll looping forever
    // with no way out. Fail toward "tap to open".
    default: return 'ready';
  }
}

// Fraction complete, 0-1. Blends completed stages' weight with elapsed time inside the
// current stage so the bar always creeps rather than freezing between jumps.
export function stageProgress(
  stage: string | null | undefined,
  stageSeenAtMs: number | null,
  nowMs: number,
): number {
  if (stage === 'queued_for_agent') return 0.02;
  const idx = STAGES.findIndex(s => s.key === stage);
  if (idx < 0) return 0.04;
  const before = STAGES.slice(0, idx).reduce((n, s) => n + s.weight, 0);
  const w = STAGES[idx].weight;
  const elapsed = stageSeenAtMs ? Math.max(0, (nowMs - stageSeenAtMs) / 1000) : 0;
  const frac = (before + Math.min(1, elapsed / w) * w) / TOTAL_WEIGHT;
  return Math.min(0.96, Math.max(0.04, frac));
}
