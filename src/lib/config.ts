// Runtime configuration, sourced from EXPO_PUBLIC_* env vars (inlined at build
// time by Expo). Copy .env.example → .env and fill these in for local dev; set
// them as EAS build secrets / eas.json "env" for real builds.
//
//  EXPO_PUBLIC_API_BASE      → the Bluelime backend (Next.js on Vercel).
//  EXPO_PUBLIC_SUPABASE_URL  → the SAME Supabase project buyers sign up against
//                              on the web (one shared account, Ryan's R-decision).
//  EXPO_PUBLIC_SUPABASE_ANON_KEY → that project's anon/public key.

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, '') || 'https://bluelime.ai';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Deep-link scheme (matches app.json "scheme"). Used to build the email-confirm
// redirect URL for Supabase PKCE.
export const APP_SCHEME = 'bluelimemobile';

// True only when Supabase credentials are present. When false the app still
// boots and renders (login shows a "not configured" notice) so `expo start`
// works with no secrets — see README.
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// The 60-minute early-access head start is enforced by the backend; the app only
// reflects it in copy (Ryan's locked decision).
export const EARLY_ACCESS_HEADSTART_MIN = 60;

// Support / moderation contact surfaced in Settings and on the EULA gate (Apple
// UGC requirement — a reachable support channel).
export const SUPPORT_EMAIL = 'support@bluelime.ai';
export const TERMS_URL = 'https://bluelime.ai/terms';
export const PRIVACY_URL = 'https://bluelime.ai/privacy';
