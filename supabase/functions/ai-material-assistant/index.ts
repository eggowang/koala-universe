import { createClient } from 'npm:@supabase/supabase-js@2'

const jsonHeaders = { 'Content-Type': 'application/json' }

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const allowedOrigin = configured.includes(origin) ? origin : (configured[0] ?? '*')
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function normalizeEndpoint(value: string) {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('AI_API_URL_INVALID')
  const pathname = url.pathname.replace(/\/+$/, '')
  if (!pathname || pathname === '/') url.pathname = '/v1/chat/completions'
  else if (/\/v1$/i.test(pathname)) url.pathname = `${pathname}/chat/completions`
  return url.toString()
}

function responseText(data: unknown) {
  const value = data as Record<string, any>
  if (typeof value?.output_text === 'string') return value.output_text.trim()
  const chatContent = value?.choices?.[0]?.message?.content
  if (typeof chatContent === 'string') return chatContent.trim()
  if (Array.isArray(chatContent)) {
    const text = chatContent.map((item) => typeof item === 'string' ? item : item?.text || item?.content || '').join('\n').trim()
    if (text) return text
  }
  if (typeof value?.choices?.[0]?.text === 'string') return value.choices[0].text.trim()
  if (Array.isArray(value?.output)) {
    const text = value.output.flatMap((item: any) => item?.content || []).map((item: any) => item?.text || '').join('\n').trim()
    if (text) return text
  }
  return ''
}

function systemPrompt(subject: string, materialType: string) {
  return `你是一名严谨的小学学习助手，帮助家长为上海小学二年级学生制作${subject}${materialType === 'exercise' ? '原创练习题' : '原创知识卡'}。内容应符合儿童理解水平，表达清楚，难度适中，不超纲。不得声称复制教材、题库或付费学习平台的原文。第一行必须写“标题：简短标题”。${materialType === 'exercise' ? '接着单独写“【题目】”并列出全部题目；最后单独写“【家长参考答案】”并列出对应答案和必要的简短解析。题目区域绝不能出现答案，答案区域也不要重复完整题目。' : '接着写“【题目】”并给出知识卡内容；如果包含自测题，再在最后单独写“【家长参考答案】”，否则不要输出答案区域。'}只输出可直接给家长审阅的学习内容。`
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...cors, ...jsonHeaders } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const apiKey = Deno.env.get('AI_API_KEY')?.trim() ?? ''
    const apiUrl = Deno.env.get('AI_API_URL')?.trim() ?? ''
    const model = Deno.env.get('AI_MODEL')?.trim() ?? ''
    if (!apiKey || !apiUrl || !model) throw new Error('AI_NOT_CONFIGURED')

    const authorization = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) throw new Error('AUTH_REQUIRED')

    const body = await req.json()
    const familyId = String(body.familyId ?? '')
    const subject = String(body.subject ?? '')
    const materialType = String(body.materialType ?? '')
    const request = String(body.request ?? '').trim()
    if (!familyId || !['语文', '数学', '英语'].includes(subject)) throw new Error('INVALID_REQUEST')
    if (!['exercise', 'note'].includes(materialType) || !request || request.length > 1200) throw new Error('INVALID_REQUEST')

    const { data: membership, error: membershipError } = await userClient
      .from('family_members')
      .select('family_id, role')
      .eq('family_id', familyId)
      .eq('user_id', authData.user.id)
      .eq('role', 'parent')
      .maybeSingle()
    if (membershipError || !membership) throw new Error('PARENT_PERMISSION_REQUIRED')

    const endpoint = normalizeEndpoint(apiUrl)
    const instructions = systemPrompt(subject, materialType)
    const input = `学生范围：上海小学二年级\n学科：${subject}\n资料类型：${materialType === 'exercise' ? '练习题' : '知识卡'}\n家长要求：${request}`
    const isResponsesApi = /\/responses\/?(?:\?|$)/i.test(endpoint)
    const payload = isResponsesApi
      ? { model, instructions, input }
      : { model, messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }] }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    let providerResponse: Response
    try {
      providerResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const raw = await providerResponse.text()
    let providerData: unknown = {}
    try { providerData = raw ? JSON.parse(raw) : {} } catch { providerData = {} }
    if (!providerResponse.ok) {
      const value = providerData as Record<string, any>
      const detail = String(value?.error?.message || value?.message || `AI_PROVIDER_${providerResponse.status}`).slice(0, 180)
      throw new Error(detail)
    }
    const text = responseText(providerData)
    if (!text) throw new Error('AI_EMPTY_RESPONSE')

    return new Response(JSON.stringify({ text }), { headers: { ...cors, ...jsonHeaders } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    const status = message === 'AUTH_REQUIRED' ? 401 : message === 'PARENT_PERMISSION_REQUIRED' ? 403 : 400
    return new Response(JSON.stringify({ error: message }), { status, headers: { ...cors, ...jsonHeaders } })
  }
})
