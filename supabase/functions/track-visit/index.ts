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
  let ip = headerIp || clientIp
  const ua = req.headers.get('user-agent') || body.userAgent || null

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

  const isGuest = !userId
  const displayName = actorName || (isGuest ? 'بازدیدکننده مهمان (ثبت‌نام نشده)' : 'کاربر ناشناس')

  // One IP per device: reuse the first IP ever recorded for this device, and
  // avoid duplicate rows for the same device within the last 24 hours.
  if (deviceId) {
    const { data: firstForDevice } = await supabase
      .from('activity_logs')
      .select('id, ip_address, occurred_at')
      .eq('event_type', 'site_visit')
      .contains('details', { device_id: deviceId })
      .order('occurred_at', { ascending: true })
      .limit(1)

    if (firstForDevice && firstForDevice.length > 0) {
      // Keep the device's canonical IP stable
      if (firstForDevice[0].ip_address) ip = firstForDevice[0].ip_address

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recent } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('event_type', 'site_visit')
        .gte('occurred_at', since)
        .contains('details', { device_id: deviceId })
        .limit(1)
      if (recent && recent.length > 0) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'device_recent' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  // Avoid duplicate rows for the same session within the last 30 minutes
  if (sessionId) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('activity_logs')
      .select('id')
      .eq('event_type', 'site_visit')
      .gte('occurred_at', since)
      .contains('details', { session_id: sessionId })
      .limit(1)
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }


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
