// Supabase client for React Native (one shared account with the web — buyers
// sign up on bluelime.ai and log in here with the same email/password).
//
// Follows the Expo/Supabase best practices:
//   • LargeSecureStore adapter for session persistence (encrypted).
//   • detectSessionInUrl:false — RN has no URL bar; deep links are handled
//     manually (email-confirm PKCE) in auth.tsx.
//   • autoRefreshToken + AppState wiring so tokens refresh while foregrounded.
//   • flowType 'pkce' for secure email-confirm / magic-link redirects.

import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { LargeSecureStore } from './secureStore';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from './config';

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      storage: LargeSecureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

// Refresh the session only while the app is in the foreground (Supabase's
// documented AppState pattern) — avoids background refresh churn.
let appStateWired = false;
export function wireAutoRefresh(): void {
  if (appStateWired || !SUPABASE_CONFIGURED) return;
  appStateWired = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** The current access token (Bearer for the backend), or null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
