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

function normalizedCode(value: unknown) {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase()
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...cors, ...jsonHeaders } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) throw new Error('AUTH_REQUIRED')

    const body = await req.json()
    const familyId = String(body.familyId ?? '')
    const code = normalizedCode(body.code)
    const pin = String(body.pin ?? '')
    if (!/^[A-HJ-NP-Z2-9]{6,10}$/.test(code)) throw new Error('FAMILY_CODE_FORMAT_INVALID')
    if (!/^[0-9]{4}$/.test(pin)) throw new Error('PIN_MUST_BE_FOUR_DIGITS')

    const { data: membership, error: membershipError } = await userClient
      .from('family_members')
      .select('family_id')
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

    const { data: existing, error: existingError } = await adminClient
      .from('families')
      .select('id')
      .eq('invite_code', code)
      .neq('id', familyId)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) throw new Error('FAMILY_CODE_TAKEN')

    const { data: child, error: childError } = await adminClient
      .from('children')
      .select('auth_user_id')
      .eq('family_id', familyId)
      .single()
    if (childError || !child?.auth_user_id || !family.child_login_email) throw new Error('CHILD_LOGIN_NOT_READY')

    // A child password embeds the family code and current PIN, so update it
    // before exposing the new code. If the database update then fails, the
    // same PIN lets us restore the old credential and keep login available.
    const newPassword = `Koala!${code}!${pin}`
    const oldPassword = `Koala!${family.invite_code}!${pin}`
    const pinVerifier = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { error: pinError } = await pinVerifier.auth.signInWithPassword({ email: family.child_login_email, password: oldPassword })
    if (pinError) throw new Error('CHILD_PIN_INCORRECT')
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(child.auth_user_id, { password: newPassword })
    if (passwordError) throw passwordError

    const { error: codeError } = await adminClient
      .from('families')
      .update({ invite_code: code, updated_at: new Date().toISOString() })
      .eq('id', familyId)
    if (codeError) {
      await adminClient.auth.admin.updateUserById(child.auth_user_id, { password: oldPassword })
      if (String(codeError.message || '').includes('duplicate')) throw new Error('FAMILY_CODE_TAKEN')
      throw codeError
    }

    return new Response(JSON.stringify({ familyCode: code }), { headers: { ...cors, ...jsonHeaders } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...cors, ...jsonHeaders } })
  }
})
