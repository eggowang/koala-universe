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

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...cors, ...jsonHeaders } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) throw new Error('AUTH_REQUIRED')

    const body = await req.json()
    const familyId = String(body.familyId ?? '')
    const pin = String(body.pin ?? '')
    if (!/^[0-9]{4}$/.test(pin)) throw new Error('PIN_MUST_BE_FOUR_DIGITS')

    const { data: membership, error: membershipError } = await userClient
      .from('family_members')
      .select('family_id, role')
      .eq('family_id', familyId)
      .eq('user_id', authData.user.id)
      .eq('role', 'parent')
      .maybeSingle()
    if (membershipError || !membership) throw new Error('PARENT_PERMISSION_REQUIRED')

    const { data: family, error: familyError } = await adminClient
      .from('families')
      .select('id, invite_code, child_login_email')
      .eq('id', familyId)
      .single()
    if (familyError || !family) throw new Error('FAMILY_NOT_FOUND')

    const { data: child, error: childError } = await adminClient
      .from('children')
      .select('id, auth_user_id, nickname')
      .eq('family_id', familyId)
      .single()
    if (childError || !child) throw new Error('CHILD_NOT_FOUND')

    // example.com is a reserved, syntactically valid domain. This account is
    // created as already confirmed and never receives email.
    const loginEmail = family.child_login_email || `child-${familyId}@example.com`
    const password = `Koala!${family.invite_code}!${pin}`
    let childUserId = child.auth_user_id as string | null

    if (childUserId) {
      const { error } = await adminClient.auth.admin.updateUserById(childUserId, { password })
      if (error) throw error
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: loginEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: child.nickname, app_role: 'child' },
      })
      if (error || !data.user) throw error ?? new Error('CHILD_USER_CREATE_FAILED')
      childUserId = data.user.id
    }

    const { error: memberError } = await adminClient.from('family_members').upsert({
      family_id: familyId,
      user_id: childUserId,
      role: 'child',
      display_name: child.nickname,
    }, { onConflict: 'family_id,user_id' })
    if (memberError) throw memberError

    const { error: childUpdateError } = await adminClient.from('children')
      .update({ auth_user_id: childUserId, updated_at: new Date().toISOString() })
      .eq('id', child.id)
    if (childUpdateError) throw childUpdateError

    const { error: familyUpdateError } = await adminClient.from('families')
      .update({ child_login_email: loginEmail, updated_at: new Date().toISOString() })
      .eq('id', familyId)
    if (familyUpdateError) throw familyUpdateError

    return new Response(JSON.stringify({ familyCode: family.invite_code }), { headers: { ...cors, ...jsonHeaders } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...cors, ...jsonHeaders } })
  }
})
