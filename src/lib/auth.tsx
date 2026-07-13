// Auth context — wraps Supabase RN auth (one shared account with the web).
// Exposes session state + sign-in / sign-up (with EULA gate) / sign-out, and
// wires push registration + AppState token refresh on sign-in.

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase, wireAutoRefresh } from './supabase';
import { SUPABASE_CONFIGURED, APP_SCHEME } from './config';
import { registerForPush } from './push';

interface AuthState {
  ready: boolean;              // initial session check complete
  session: Session | null;
  signedIn: boolean;
  email: string | null;
  configured: boolean;         // Supabase creds present
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  ready: false, session: null, signedIn: false, email: null, configured: SUPABASE_CONFIGURED,
  signIn: async () => {}, signUp: async () => ({ needsConfirm: false }), signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const pushedFor = useRef<string | null>(null);

  useEffect(() => {
    wireAutoRefresh();

    if (!SUPABASE_CONFIGURED) {
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    // Handle the PKCE email-confirm deep link (bluelimemobile://auth?code=...).
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const { queryParams } = Linking.parse(url);
      const code = queryParams?.code;
      if (typeof code === 'string') {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const linkSub = Linking.addEventListener('url', (e) => handleUrl(e.url));

    return () => {
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  // Register for push once per signed-in user.
  useEffect(() => {
    const uid = session?.user?.id ?? null;
    if (uid && pushedFor.current !== uid) {
      pushedFor.current = uid;
      registerForPush().catch(() => {});
    }
    if (!uid) pushedFor.current = null;
  }, [session?.user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
  };

  const signUp = async (email: string, password: string) => {
    const redirectTo = Linking.createURL('auth', { scheme: APP_SCHEME });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw new Error(error.message);
    // If email confirmation is on, there's a user but no session yet.
    return { needsConfirm: !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
  };

  return (
    <Ctx.Provider
      value={{
        ready,
        session,
        signedIn: !!session,
        email: session?.user?.email ?? null,
        configured: SUPABASE_CONFIGURED,
        signIn, signUp, signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
