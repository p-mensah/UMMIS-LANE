import { supabase } from './supabase';

async function callAdminApi(action: string, payload: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Admin API error');
  return json.data;
}

export const inviteUser = (email: string, role: string) => callAdminApi('invite_user', { email, role });
export const createUser = (email: string, password: string, role: string) => callAdminApi('create_user', { email, password, role });
export const assignRole = (userId: string, role: string) => callAdminApi('assign_role', { userId, role });
export const suspendUser = (userId: string) => callAdminApi('suspend_user', { userId });
export const reactivateUser = (userId: string) => callAdminApi('reactivate_user', { userId });
export const deleteUser = (userId: string) => callAdminApi('delete_user', { userId });
