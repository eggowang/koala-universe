import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

function hongKongNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}:${value.second}` }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response(JSON.stringify({ error: 'CRON_AUTH_REQUIRED' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const siteUrl = Deno.env.get('SITE_URL')!
    const now = hongKongNow()
    const { data: missions, error: missionError } = await adminClient.from('missions')
      .select('id, child_id, title, section_name')
      .eq('scheduled_date', now.date).eq('status', 'todo').is('reminder_sent_at', null)
      .not('reminder_time', 'is', null).lte('reminder_time', now.time).limit(100)
    if (missionError) throw missionError

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )
    let sent = 0
    for (const mission of missions ?? []) {
      const { data: child } = await adminClient.from('children').select('auth_user_id, nickname').eq('id', mission.child_id).single()
      if (!child?.auth_user_id) continue
      const { data: subscriptions } = await adminClient.from('push_subscriptions').select('*').eq('user_id', child.auth_user_id)
      const notification = {
        title: `${mission.section_name}任务时间到了`,
        body: `${child.nickname}，准备完成“${mission.title}”吧。`,
        navigate: siteUrl,
        tag: `reminder-${mission.id}`,
        app_badge: '1',
        silent: false,
      }
      const payload = JSON.stringify({ web_push: 8030, notification, title: notification.title, body: notification.body, url: siteUrl, tag: notification.tag })
      await Promise.all((subscriptions ?? []).map(async (subscription) => {
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret } }, payload)
          sent += 1
        } catch (error) {
          const status = Number((error as { statusCode?: number }).statusCode || 0)
          if (status === 404 || status === 410) await adminClient.from('push_subscriptions').delete().eq('id', subscription.id)
        }
      }))
      await adminClient.from('missions').update({ reminder_sent_at: new Date().toISOString() }).eq('id', mission.id)
    }
    return new Response(JSON.stringify({ checked: missions?.length ?? 0, sent }), { headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
