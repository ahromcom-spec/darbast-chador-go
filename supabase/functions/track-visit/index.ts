// Logs every site visit (including anonymous / unregistered visitors) into
// public.activity_logs so the CEO activity-log module shows who visited,
// from which IP, and on which page. verify_jwt = false so guests can call it.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, serviceKey)

  let body: any = {}
  try { body = await req.json() } catch { /* empty body allowed */ }

  const page: string = body.page || '/'
  const pageTitle: string | null = body.pageTitle || null
  const referrer: string | null = body.referrer || null
  const sessionId: string | null = body.sessionId || null
  const deviceId: string | null = body.deviceId || body.device_id || null
  const deviceType: string | null = body.deviceType || null
  const clientIp: string | null = body.ip || null
  const userId: string | null = body.userId || null

  const headerIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    null
  // Prefer the client's stable (device-cached) IP so proxies/CGNAT/Cloudflare WARP
  // rotation does not create a new "identity" on every visit.
  let ip = clientIp || headerIp
  const ua = req.headers.get('user-agent') || body.userAgent || null
  const lang = req.headers.get('accept-language') || ''

  // Server-side device fingerprint: stable even when localStorage is cleared or
  // the visitor is in private mode. Uses UA + language + IP network (/16).
  const ipNet = (ip || '').split('.').slice(0, 2).join('.')
  const fpSource = `${ua || ''}|${lang}|${ipNet}`
  let deviceFp = 'fp-unknown'
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fpSource))
    deviceFp = 'fp-' + Array.from(new Uint8Array(digest)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch { /* ignore */ }

  let actorName: string | null = null
  let actorPhone: string | null = null
  if (userId) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('user_id', userId)
      .maybeSingle()
    actorName = prof?.full_name || null
    actorPhone = prof?.phone_number || null
  }

  let resolvedUserId = userId
  let isGuest = !resolvedUserId

  // One IP per device: reuse the first IP recorded for this device fingerprint /
  // device id, so the same phone always shows the same IP in the log.
  const identityFilters: Array<Record<string, string>> = []
  if (deviceId) identityFilters.push({ device_id: deviceId })
  identityFilters.push({ device_fp: deviceFp })

  for (const filter of identityFilters) {
    const { data: firstForDevice } = await supabase
      .from('activity_logs')
      .select('id, ip_address, occurred_at')
      .eq('event_type', 'site_visit')
      .contains('details', filter)
      .order('occurred_at', { ascending: true })
      .limit(1)

    if (firstForDevice && firstForDevice.length > 0) {
      if (firstForDevice[0].ip_address) ip = firstForDevice[0].ip_address
      break
    }
  }

  // If this device previously visited while signed in, keep showing that
  // registered customer's name even when they are now browsing as a guest.
  if (!resolvedUserId) {
    for (const filter of identityFilters) {
      const { data: known } = await supabase
        .from('activity_logs')
        .select('actor_user_id, actor_name, actor_phone, occurred_at')
        .eq('event_type', 'site_visit')
        .not('actor_user_id', 'is', null)
        .contains('details', filter)
        .order('occurred_at', { ascending: false })
        .limit(1)

      if (known && known.length > 0 && known[0].actor_user_id) {
        resolvedUserId = known[0].actor_user_id as string
        actorName = known[0].actor_name as string | null
        actorPhone = known[0].actor_phone as string | null
        isGuest = false
        break
      }
    }
  }

  if (resolvedUserId && !actorName) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('user_id', resolvedUserId)
      .maybeSingle()
    actorName = prof?.full_name || actorName
    actorPhone = prof?.phone_number || actorPhone
  }

  const displayName = actorName || (isGuest ? 'بازدیدکننده مهمان (ثبت‌نام نشده)' : 'کاربر ناشناس')

  const title = isGuest
    ? `بازدید مهمان از سایت${ip ? ` — IP: ${ip}` : ''}`
    : `بازدید ${displayName}${actorPhone ? ` (${actorPhone})` : ''} از سایت`



  const { data, error } = await supabase.from('activity_logs').insert({
    event_type: 'site_visit',
    event_category: 'visitor',
    action: 'view',
    module_name: 'بازدید سایت',
    entity_table: null,
    entity_id: null,
    title,
    actor_user_id: userId,
    actor_name: displayName,
    actor_phone: actorPhone,
    details: {
      session_id: sessionId,
      device_id: deviceId,
      device_fp: deviceFp,

      page,
      page_title: pageTitle,
      referrer,
      device_type: deviceType,
      ip,
      is_guest: isGuest,
    },
    user_agent: ua,
    ip_address: ip,
  }).select('id').single()

  if (error) {
    console.error('[track-visit] insert failed', error)
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, id: data?.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
