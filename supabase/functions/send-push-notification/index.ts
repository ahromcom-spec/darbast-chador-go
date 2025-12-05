import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID');
    const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, title, body, link, type, callData } = await req.json();

    console.log('[Push] Request for user:', user_id, 'Type:', type);

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create in-app notification
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id,
      title,
      body,
      link: link || '/',
      type: type || 'info'
    });
    
    if (notifError) {
      console.error('[Push] In-app notification error:', notifError);
    } else {
      console.log('[Push] ✓ In-app notification created');
    }

    // Send OneSignal push notification
    let pushSent = false;
    if (oneSignalAppId && oneSignalApiKey) {
      try {
        console.log('[Push] Sending OneSignal notification...');
        
        // Prepare notification data
        const notificationData: any = {
          app_id: oneSignalAppId,
          include_external_user_ids: [user_id],
          headings: { fa: title, en: title },
          contents: { fa: body, en: body },
          url: link ? `https://ahrom.org${link}` : 'https://ahrom.org/',
          // چند ثانیه زمان برای دریافت اعلان
          ttl: 86400, // 24 hours
        };

        // Add special handling for incoming calls
        if (type === 'incoming-call' && callData) {
          notificationData.data = {
            type: 'incoming-call',
            orderId: callData.orderId,
            callerName: callData.callerName,
            callerId: callData.callerId
          };
          // Higher priority for calls
          notificationData.priority = 10;
          // Custom sound for calls
          notificationData.android_sound = 'incoming_call';
          notificationData.ios_sound = 'incoming_call.caf';
          // Action buttons for calls
          notificationData.buttons = [
            { id: 'answer', text: 'پاسخ' },
            { id: 'reject', text: 'رد' }
          ];
        }

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Basic ${oneSignalApiKey}`
          },
          body: JSON.stringify(notificationData)
        });

        const result = await response.json();
        
        if (response.ok && result.id) {
          console.log('[Push] ✓ OneSignal notification sent:', result.id);
          pushSent = true;
        } else {
          console.error('[Push] OneSignal error:', result);
        }
      } catch (oneSignalError) {
        console.error('[Push] OneSignal request failed:', oneSignalError);
      }
    } else {
      console.log('[Push] OneSignal not configured, skipping push');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification created',
        inAppCreated: !notifError,
        pushSent
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const e = error as Error;
    console.error('[Push] Error:', e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
