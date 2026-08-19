// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')!
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  // 1. Verify caller is an authenticated admin
  const { data: { user }, error: userErr } = await supabaseClient.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
  }

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 })
  }

  // Admin client with service role — only used server-side, never exposed to frontend
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { action, payload } = await req.json()

  switch (action) {
    case 'invite_user': {
      // Sends an invite email; user sets their own password
      const { email, role = 'staff' } = payload
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email)
      if (error) return err(error.message)

      await adminClient.from('profiles').update({ role }).eq('id', data.user.id)
      return ok(data)
    }

    case 'create_user': {
      // Directly create with a password (no email invite flow)
      const { email, password, role = 'staff' } = payload
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error) return err(error.message)

      await adminClient.from('profiles').update({ role }).eq('id', data.user.id)
      return ok(data)
    }

    case 'assign_role': {
      const { userId, role } = payload // role: 'admin' | 'staff'
      if (userId === user.id && role !== 'admin') {
        return err('Cannot demote yourself')
      }
      const { error } = await adminClient
        .from('profiles')
        .update({ role })
        .eq('id', userId)
      if (error) return err(error.message)
      return ok({ success: true })
    }

    case 'suspend_user': {
      const { userId } = payload
      if (userId === user.id) return err('Cannot suspend yourself')

      // Ban them from logging in via Supabase Auth
      await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: '876000h', // effectively indefinite (~100 years)
      })
      await adminClient.from('profiles').update({ status: 'suspended' }).eq('id', userId)
      return ok({ success: true })
    }

    case 'reactivate_user': {
      const { userId } = payload
      await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      })
      await adminClient.from('profiles').update({ status: 'active' }).eq('id', userId)
      return ok({ success: true })
    }

    case 'delete_user': {
      const { userId } = payload
      if (userId === user.id) return err('Cannot delete yourself')

      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) return err(error.message)
      // profile row deleted automatically if you set up ON DELETE CASCADE
      return ok({ success: true })
    }

    default:
      return err('Unknown action')
  }
})

function ok(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
function err(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
}
