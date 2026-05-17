import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

let mod;
try {
  mod = await import('./config.local.js');
} catch {
  mod = null;
}

const supabaseUrl = mod?.supabaseUrl?.trim?.() ?? '';
const supabaseAnonKey = mod?.supabaseAnonKey?.trim?.() ?? '';

const looksUnconfigured =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes('YOUR_PROJECT') ||
  supabaseAnonKey.includes('YOUR_SUPABASE');

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey && !looksUnconfigured);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null;

export async function getSession () {
  if (!supabase) return { data: { session: null }, error: new Error('missing_config') };
  return supabase.auth.getSession();
}

export async function signOutEverywhere () {
  if (!supabase) return { error: new Error('missing_config') };
  return supabase.auth.signOut();
}
