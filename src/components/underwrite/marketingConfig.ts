// The free-report count ({N}) and the per-report price are MARKETING NUMBERS, not
// app constants. They live in platform_settings and are edited from the admin panel;
// the website reads them through lib/marketing-config.ts on every render, so the web
// and the app must not disagree about what a new user is being offered.
//
// Why a fetch and not a constant: the app's own code previously implied 10 free
// reports (the legacy `free_underwriting_reports` row still says 10) while the value
// actually granted to a new org is `uw_trial_runs` = 3. A hardcoded 10 is a promise
// the product does not keep, and an OTA-shipped binary cannot be corrected the day
// Ryan changes the number in the admin panel.
//
// GET /api/marketing-config EXISTS and is public — it returns freeUnderwritingReports,
// resolved server-side from platform_settings (uw_trial_runs wins over the legacy
// free_underwriting_reports, so the number served is the real grant, not the stale 10).
// So {N} DOES populate; do not go build this route again.
//
// What it does NOT return is a price range, so priceRange stays null and the pricing
// line omits the number. That half of the gap is real and needs a web change.

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/config';

/** Public, unauthenticated. Mirrors the shape of the web's MarketingConfig. */
const ENDPOINT = '/api/marketing-config';

// Short, because this gates nothing: the pitch renders immediately with the
// number-free copy and only gains a number if the answer arrives.
const TIMEOUT_MS = 6000;

export interface UnderwritePricing {
  /** null = we do not know; copy MUST then carry no number. */
  freeReports: number | null;
  /** e.g. "$4–$5". null = say nothing about price. */
  priceRange: string | null;
}

const UNKNOWN: UnderwritePricing = { freeReports: null, priceRange: null };

interface MarketingConfigResponse {
  freeUnderwritingReports?: unknown;
  uwPriceRange?: unknown;
}

// Session cache. Only a SUCCESS is cached — a failure must stay retryable, because
// the usual cause is a cold/offline first launch rather than a missing endpoint.
let cached: UnderwritePricing | null = null;

function coerce(raw: MarketingConfigResponse): UnderwritePricing {
  const n = typeof raw.freeUnderwritingReports === 'number' ? raw.freeUnderwritingReports : NaN;
  const range = typeof raw.uwPriceRange === 'string' ? raw.uwPriceRange.trim() : '';
  return {
    // 0 is a legitimate configured value meaning "no free reports" — but it is also
    // what a missing/garbled field coerces to, and the copy reads "your first 0
    // reports are free". Treat anything below 1 as unknown so the number-free
    // fallback runs instead.
    freeReports: Number.isFinite(n) && n >= 1 ? Math.floor(n) : null,
    priceRange: range || null,
  };
}

async function fetchPricing(): Promise<UnderwritePricing> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${ENDPOINT}`, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return UNKNOWN;
    const body = (await res.json()) as MarketingConfigResponse;
    return coerce(body);
  } catch {
    // Offline, timed out, 404, or HTML from a route that isn't there — all the same
    // answer: we don't know the number, so we don't state one.
    return UNKNOWN;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The free-report count + price range for the pitch copy.
 *
 * Starts at UNKNOWN on purpose: the first paint says "your first reports are free"
 * and either stays that way or gains a number. It never shows one number and then
 * swaps it for another, which is what a hardcoded default would do.
 */
export function useUnderwritePricing(): UnderwritePricing {
  const [pricing, setPricing] = useState<UnderwritePricing>(cached ?? UNKNOWN);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    fetchPricing().then((next) => {
      if (next.freeReports != null || next.priceRange != null) cached = next;
      if (alive) setPricing(next);
    });
    return () => { alive = false; };
  }, []);

  return pricing;
}
