import { createClient } from 'npm:@supabase/supabase-js@2'

const jsonHeaders = { 'Content-Type': 'application/json' }

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const allowedOrigin = configured.includes(origin) ? origin : (configured[0] ?? '*')
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

async function findUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const perPage = 1000
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const user = data.users.find((item) => item.email?.trim().toLowerCase() === email)
    if (user) return user
    if (data.users.length < perPage) return null
  }
  throw new Error('USER_LOOKUP_LIMIT_REACHED')
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...cors, ...jsonHeaders } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const siteUrl = Deno.env.get('SITE_URL')!
    const authorization = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) throw new Error('AUTH_REQUIRED')

    const body = await req.json()
    const familyId = String(body.familyId ?? '')
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('VALID_EMAIL_REQUIRED')

    const { data: membership, error: membershipError } = await userClient
      .from('family_members')
      .select('family_id, role')
      .eq('family_id', familyId)
      .eq('user_id', authData.user.id)
      .eq('role', 'parent')
      .maybeSingle()
    if (membershipError || !membership) throw new Error('PARENT_PERMISSION_REQUIRED')

    const existingUser = await findUserByEmail(adminClient, email)
    if (existingUser) {
      const { data: existingMembership, error: existingMembershipError } = await adminClient
        .from('family_members')
        .select('family_id, role')
        .eq('user_id', existingUser.id)
        .maybeSingle()
      if (existingMembershipError) throw existingMembershipError

      if (existingMembership?.family_id === familyId) {
        return new Response(JSON.stringify({
          alreadyMember: true,
          emailSent: false,
          shareUrl: null,
          warning: 'ALREADY_IN_FAMILY',
        }), { headers: { ...cors, ...jsonHeaders } })
      }
      if (existingMembership) {
        return new Response(JSON.stringify({
          alreadyMember: false,
          emailSent: false,
          shareUrl: null,
          warning: 'USER_ALREADY_HAS_FAMILY',
        }), { headers: { ...cors, ...jsonHeaders } })
      }
    }

    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
    const { error: inviteRowError } = await adminClient.from('parent_invites').insert({
      family_id: familyId,
      email,
      token,
      invited_by: authData.user.id,
    })
    if (inviteRowError) throw inviteRowError

    const redirectTo = `${siteUrl}${siteUrl.includes('?') ? '&' : '?'}invite=${encodeURIComponent(token)}`
    if (existingUser) {
      return new Response(JSON.stringify({
        alreadyMember: false,
        emailSent: false,
        shareUrl: redirectTo,
        warning: 'EMAIL_ALREADY_REGISTERED',
      }), { headers: { ...cors, ...jsonHeaders } })
    }

    const { error: mailError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { family_invite_token: token },
    })

    return new Response(JSON.stringify({
      alreadyMember: false,
      emailSent: !mailError,
      shareUrl: redirectTo,
      warning: mailError ? 'EMAIL_SEND_FAILED' : null,
    }), { headers: { ...cors, ...jsonHeaders } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...cors, ...jsonHeaders } })
  }
})
