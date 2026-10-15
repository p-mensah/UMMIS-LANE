/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { logNetworkError } from './networkLogger';

const rawUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  ''
).trim();

const normalizedUrl = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;

export const isConfiguredSupabaseUrl = Boolean(
  normalizedUrl &&
  (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) &&
  !normalizedUrl.includes('placeholder.supabase.co') &&
  !normalizedUrl.includes('your-project.supabase.co')
);

export const supabaseUrl = isConfiguredSupabaseUrl
  ? normalizedUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
  : (import.meta.env.VITE_SUPABASE_URL || '');

export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Custom fetch wrapper that intercepts and logs response headers on error or HTML response
const customSupabaseFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    if (!res.ok || isHtml) {
      const headerMap: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headerMap[key] = val;
      });

      let snippet = '';
      try {
        const cloned = res.clone();
        snippet = await cloned.text();
      } catch {}

      logNetworkError({
        url,
        status: res.status,
        statusText: res.statusText,
        headers: headerMap,
        contentType,
        bodySnippet: snippet,
        sourceHook: 'SupabaseClient',
        isHtml
      });
    }

    return res;
  } catch (err: any) {
    logNetworkError({
      url,
      status: 0,
      statusText: err?.message || 'Network Fetch Failed',
      headers: {},
      sourceHook: 'SupabaseClient',
      bodySnippet: err?.message || 'Failed to fetch Supabase endpoint'
    });
    throw err;
  }
};

export const supabase: any = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: customSupabaseFetch,
  },
});
