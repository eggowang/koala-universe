import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const jsonHeaders = { 'Content-Type': 'application/json' }

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  return {
    'Access-Control-Allow-Origin': configured.includes(origin) ? origin : (configured[0] ?? '*'),
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
    const siteUrl = Deno.env.get('SITE_URL')!
    const authorization = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const adminClient = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) throw new Error('AUTH_REQUIRED')

    const body = await req.json()
    if (body.type !== 'mission_submitted') throw new Error('UNSUPPORTED_NOTIFICATION_TYPE')
    const missionId = String(body.missionId ?? '')
    const { data: mission, error: missionError } = await adminClient.from('missions')
      .select('id, family_id, child_id, title, status').eq('id', missionId).single()
    if (missionError || !mission) throw new Error('MISSION_NOT_FOUND')
    const { data: child, error: childError } = await adminClient.from('children')
      .select('auth_user_id, nickname').eq('id', mission.child_id).single()
    if (childError || !child || child.auth_user_id !== authData.user.id) throw new Error('CHILD_PERMISSION_REQUIRED')
    if (mission.status !== 'submitted') throw new Error('MISSION_NOT_SUBMITTED')

    const { data: parents, error: parentError } = await adminClient.from('family_members')
      .select('user_id').eq('family_id', mission.family_id).eq('role', 'parent')
    if (parentError) throw parentError
    const parentIds = (parents ?? []).map((item) => item.user_id)
    if (!parentIds.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...cors, ...jsonHeaders } })
    const { data: subscriptions, error: subscriptionError } = await adminClient.from('push_subscriptions')
      .select('*').in('user_id', parentIds)
    if (subscriptionError) throw subscriptionError

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )
    const notification = {
      title: '考拉提交了新任务',
      body: `${child.nickname} 已完成“${mission.title}”，等待你的确认。`,
      navigate: siteUrl,
      tag: `mission-${mission.id}`,
      app_badge: '1',
      silent: false,
    }
    const payload = JSON.stringify({ web_push: 8030, notification, title: notification.title, body: notification.body, url: siteUrl, tag: notification.tag })
    let sent = 0
    await Promise.all((subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
        }, payload)
        sent += 1
      } catch (error) {
        const status = Number((error as { statusCode?: number }).statusCode || 0)
        if (status === 404 || status === 410) await adminClient.from('push_subscriptions').delete().eq('id', subscription.id)
      }
    }))
    return new Response(JSON.stringify({ sent }), { headers: { ...cors, ...jsonHeaders } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...cors, ...jsonHeaders } })
  }
})
