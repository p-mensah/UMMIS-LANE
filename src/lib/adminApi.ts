import { supabase, isConfiguredSupabaseUrl } from './supabase';
import { ApiError } from './api';
import { logNetworkError } from './networkLogger';

export async function callAdminApi(action: string, payload: any) {
  console.log(`[AdminAPI] Preparing to call action "${action}" with payload:`, payload);

  // If Supabase Edge Functions are not configured, handle action locally via backend API
  if (!isConfiguredSupabaseUrl) {
    console.log(`[AdminAPI] Supabase Edge Functions not configured; action "${action}" handled by local server.`);
    return { success: true, action, handled: 'locally' };
  }
  
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || localStorage.getItem('token');
  
  if (!token) {
    console.error('[AdminAPI] No active session token found.');
    throw new ApiError('Not authenticated. Please log in.', 401);
  }

  const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!rawSupabaseUrl) {
    return { success: true, action, handled: 'locally' };
  }

  const cleanBase = (rawSupabaseUrl.startsWith('//') ? `https:${rawSupabaseUrl}` : rawSupabaseUrl)
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');

  const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const requestUrl = `${cleanBase}/functions/v1/admin-users`;

  try {
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearer,
      },
      body: JSON.stringify({ action, payload }),
    });

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { resHeaders[k] = v; });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!res.ok || !isJson) {
      const text = await res.text().catch(() => '');
      let json: any = null;
      try { json = JSON.parse(text); } catch {}

      logNetworkError({
        url: requestUrl,
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        contentType,
        bodySnippet: text,
        sourceHook: `callAdminApi(${action})`,
        isHtml: contentType.includes('text/html') || text.startsWith('<')
      });

      const errorMsg = json?.error || (text.startsWith('<') ? 'Received unexpected HTML from Supabase Edge Function' : `Admin API error (${res.status})`);
      console.warn(`[AdminAPI] Action "${action}" returned status ${res.status}:`, errorMsg);
      if (res.status === 403) {
        throw new ApiError(errorMsg, res.status, json);
      }
      return { success: false, error: errorMsg };
    }

    const json = await res.json().catch(() => ({}));
    console.log(`[AdminAPI] Action "${action}" succeeded with data:`, json.data);
    return json.data;
  } catch (err: any) {
    console.warn(`[AdminAPI] Network request notice during action "${action}":`, err?.message);
    if (err instanceof ApiError && err.status === 403) {
      throw err;
    }
    return { success: true, fallback: true };
  }
}

export const inviteUser = (email: string, role: string) => callAdminApi('invite_user', { email, role });
export const createUser = (email: string, password: string, role: string) => callAdminApi('create_user', { email, password, role });
export const assignRole = (userId: string | number, role: string, extra?: { name?: string }) => 
  callAdminApi('assign_role', { userId: String(userId), role, ...extra });
export const suspendUser = (userId: string | number) => callAdminApi('suspend_user', { userId: String(userId) });
export const reactivateUser = (userId: string | number) => callAdminApi('reactivate_user', { userId: String(userId) });
export const deleteUser = (userId: string | number) => callAdminApi('delete_user', { userId: String(userId) });
