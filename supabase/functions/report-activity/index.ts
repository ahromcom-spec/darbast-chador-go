import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Public-facing reporter: writes an entry to public.activity_logs.
// DB triggers then evaluate email rules and may send transactional emails.
// verify_jwt = false so DB triggers and the browser can both call.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, serviceKey)

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const eventType: string = body.eventType || body.event_type || 'رویداد'
  const eventCategory: string = body.eventCategory || body.event_category || 'general'
  const action: string = body.action || 'event'
  const moduleName: string | null = body.moduleName || body.module_name || null
  const entityTable: string | null = body.entityTable || body.entity_table || null
  const entityId: string | null = body.entityId || body.entity_id || null
  const title: string = body.title || eventType
  const details: Record<string, any> = body.details || {}
  let actorName: string | null = body.actorName || null
  let actorPhone: string | null = body.actorPhone || null
  let actorEmail: string | null = body.actorEmail || null
  const actorUserId: string | null = body.actorUserId || body.actor_user_id || null

  if (actorUserId && (!actorName || !actorPhone || !actorEmail)) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('user_id', actorUserId)
      .maybeSingle()
    if (prof) {
      actorName = actorName || prof.full_name || null
      actorPhone = actorPhone || prof.phone_number || null
      actorEmail = actorEmail || (prof as any).email || null
    }
  }

  const ua = req.headers.get('user-agent') || null
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null

  const { data, error } = await supabase.from('activity_logs').insert({
    event_type: eventType,
    event_category: eventCategory,
    action,
    module_name: moduleName,
    entity_table: entityTable,
    entity_id: entityId,
    title,
    actor_user_id: actorUserId,
    actor_name: actorName,
    actor_phone: actorPhone,
    actor_email: actorEmail,
    details,
    user_agent: ua,
    ip_address: ip,
  }).select('id').single()

  if (error) {
    console.error('activity_logs insert failed', error)
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fire-and-forget push to CEO so every activity log shows up as a notification.
  try {
    const pushTitle = title || eventType || 'رویداد جدید'
    const pushBodyParts: string[] = []
    if (actorName) pushBodyParts.push(actorName)
    if (actorPhone) pushBodyParts.push(actorPhone)
    if (moduleName) pushBodyParts.push(moduleName)
    const pushBody = pushBodyParts.join(' • ') || action || 'رویداد جدید در سایت اهرم'

    // best-effort, do not await long
    supabase.functions.invoke('send-onesignal-push', {
      body: {
        title: pushTitle,
        body: pushBody,
        url: '/activity-logs',
        phone: '09125511494',
      },
    }).then(({ error: pushErr }) => {
      if (pushErr) console.error('[report-activity] push error', pushErr)
      else console.log('[report-activity] push dispatched to CEO')
    }).catch((e) => console.error('[report-activity] push exception', e))
  } catch (e) {
    console.error('[report-activity] push setup failed', e)
  }

  return new Response(JSON.stringify({ ok: true, id: data?.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
