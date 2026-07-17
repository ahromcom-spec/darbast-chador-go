import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CEO phone — receives all management push notifications via OneSignal
const CEO_PHONE = '09125511494';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get('ONESIGNAL_APP_ID')?.trim().replace(/^["']|["']$/g, '');
    const restKey = Deno.env.get('ONESIGNAL_REST_API_KEY')?.trim().replace(/^["']|["']$/g, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!appId || !restKey) {
      console.error('[OneSignal] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY');
      return new Response(JSON.stringify({ error: 'OneSignal not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[OneSignal] appId len:', appId?.length, 'restKey len:', restKey?.length);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { title, body: text, url, user_id: explicitUserId, phone: explicitPhone } = body as {
      title?: string; body?: string; url?: string; user_id?: string; phone?: string;
    };

    if (!title || !text) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve target user_id (defaults to CEO by phone)
    let userId = explicitUserId || null;
    if (!userId) {
      const phone = explicitPhone || CEO_PHONE;
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone_number', phone)
        .maybeSingle();
      userId = profile?.user_id || null;
      if (!userId) {
        console.warn('[OneSignal] No profile for phone', phone);
        return new Response(JSON.stringify({ error: 'Target user not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const launchUrl = url
      ? (url.startsWith('http') ? url : `https://ahrom.ir${url.startsWith('/') ? '' : '/'}${url}`)
      : 'https://ahrom.ir/';

    const payload = {
      app_id: appId,
      target_channel: 'push',
      include_aliases: { external_id: [userId] },
      headings: { en: title, fa: title },
      contents: { en: text, fa: text },
      url: launchUrl,
      chrome_web_icon: 'https://ahrom.ir/icons/icon-512-v3.png',
      chrome_web_badge: 'https://ahrom.ir/icons/icon-192.png',
    };

    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': restKey!.startsWith('os_v2_') ? `Key ${restKey}` : `Basic ${restKey}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    console.log('[OneSignal] status', res.status, responseText);

    // Also store in in-app notifications table (best-effort)
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title,
        body: text,
        link: url || '/',
        type: 'info',
      });
    } catch (e) {
      console.error('[OneSignal] in-app insert failed', e);
    }

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'OneSignal API error', details: responseText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, onesignal: JSON.parse(responseText) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    const err = e as Error;
    console.error('[OneSignal] error', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
