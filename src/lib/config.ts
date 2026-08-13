// Runtime configuration, sourced from EXPO_PUBLIC_* env vars (inlined at build
// time by Expo). Copy .env.example → .env and fill these in for local dev; set
// them as EAS build secrets / eas.json "env" for real builds.
//
//  EXPO_PUBLIC_API_BASE      → the RealtyZoom backend (Next.js on Vercel).
//  EXPO_PUBLIC_SUPABASE_URL  → the SAME Supabase project buyers sign up against
//                              on the web (one shared account, Ryan's R-decision).
//  EXPO_PUBLIC_SUPABASE_ANON_KEY → that project's anon/public key.

// realtyzoom.com, NOT bluelime.ai (Ryan, 2026-08-13): bluelime.ai is being
// repurposed for a different product, so anything RealtyZoom pointing at it is a
// scheduled breakage. realtyzoom.com already serves this app with full route
// parity — verified live on /marketplace, /underwriting, /privacy, /terms, /support.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, '') || 'https://realtyzoom.com';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Deep-link scheme (matches app.json "scheme"). Used to build the email-confirm
// redirect URL for Supabase PKCE.
//
// MUST stay in sync with app.json "scheme" — they are two copies of one fact, and
// a mismatch breaks signup silently (Supabase would redirect to a scheme no app
// claims). Also must be present in Supabase's Redirect URL allowlist as
// `realtyzoom://**` or the redirect is discarded for the Site URL instead.
export const APP_SCHEME = 'realtyzoom';

// True only when Supabase credentials are present. When false the app still
// boots and renders (login shows a "not configured" notice) so `expo start`
// works with no secrets — see README.
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// The 60-minute early-access head start is enforced by the backend; the app only
// reflects it in copy (Ryan's locked decision).
export const EARLY_ACCESS_HEADSTART_MIN = 60;

// Support / moderation contact surfaced in Settings and on the EULA gate (Apple
// UGC requirement — a reachable support channel).
// support@realtyzoom.com is the canonical address — it already matches
// `BUSINESS.supportEmail` in the web app's lib/legal/business.ts, which drives the
// privacy policy, terms, support page and the A2P 10DLC filing. The app was the
// only surface still on @bluelime.ai.
export const SUPPORT_EMAIL = 'support@realtyzoom.com';
export const TERMS_URL = 'https://realtyzoom.com/terms';
export const PRIVACY_URL = 'https://realtyzoom.com/privacy';
