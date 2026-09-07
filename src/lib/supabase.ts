/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const isConfiguredSupabaseUrl = Boolean(
  rawUrl &&
  (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) &&
  !rawUrl.includes('puxzctsfjlztnburbplf')
);

const supabaseUrl = isConfiguredSupabaseUrl
  ? rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
  : 'https://placeholder.supabase.co';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// If a valid custom Supabase project is provided, instantiate the official client
// Otherwise provide a safe no-op stub that resolves cleanly without network exceptions
export const supabase: any = isConfiguredSupabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error('Local database auth active.') }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            then: (resolve: any) => resolve({ data: [], error: null })
          }),
          single: async () => ({ data: null, error: null }),
          then: (resolve: any) => resolve({ data: [], error: null })
        }),
        insert: async () => ({ data: null, error: null }),
        update: () => ({
          eq: async () => ({ data: null, error: null })
        }),
        delete: () => ({
          eq: async () => ({ data: null, error: null })
        })
      })
    };




