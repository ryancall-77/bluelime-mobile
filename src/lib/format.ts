// Formatting helpers. Money is integer cents everywhere.

export function fmtUsd(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return '—';
  const dollars = Math.round(cents / 100);
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(dollars).toLocaleString('en-US')}`;
}

// Compact form for tight card badges: $128k, $1.2M.
export function fmtUsdShort(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return '—';
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

// Parse a user-typed dollar string ("125,000" / "$125k") to integer cents.
export function dollarsToCents(input: string): number | null {
  if (!input) return null;
  let s = input.trim().toLowerCase().replace(/[$,\s]/g, '');
  let mult = 1;
  if (s.endsWith('k')) { mult = 1_000; s = s.slice(0, -1); }
  else if (s.endsWith('m')) { mult = 1_000_000; s = s.slice(0, -1); }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * mult * 100);
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return String(Math.round(cents / 100));
}

export function fmtBedBath(beds: number | null, baths: number | null, sqft: number | null): string {
  const parts: string[] = [];
  if (beds != null) parts.push(`${beds} bd`);
  if (baths != null) parts.push(`${baths} ba`);
  if (sqft != null) parts.push(`${sqft.toLocaleString()} sqft`);
  return parts.join(' · ') || '—';
}

export function fmtCityState(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(', ');
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
