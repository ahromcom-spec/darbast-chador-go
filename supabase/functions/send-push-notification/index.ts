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
    const najvaApiToken = Deno.env.get('NAJVA_API_TOKEN');
    const najvaApiKey = Deno.env.get('NAJVA_API_KEY');
    
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

    // Send Najva push notification
    let pushSent = false;
    if (najvaApiToken && najvaApiKey) {
      try {
        console.log('[Push] Sending Najva notification...');
        
        // Prepare notification data for Najva API
        // Based on Najva API documentation: https://app.najva.com/api/v1/notifications/
        const notificationData: Record<string, unknown> = {
          api_key: najvaApiKey,
          title: title,
          body: body,
          url: link ? `https://ahrom.org${link}` : 'https://ahrom.org/',
          icon: 'https://ahrom.org/icon-512.png',
        };

        // Add special handling for incoming calls
        if (type === 'incoming-call' && callData) {
          notificationData.data = {
            type: 'incoming-call',
            orderId: callData.orderId,
            callerName: callData.callerName,
            callerId: callData.callerId
          };
        }

        console.log('[Push] Najva request data:', JSON.stringify(notificationData));

        const response = await fetch('https://app.najva.com/api/v1/notifications/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${najvaApiToken}`
          },
          body: JSON.stringify(notificationData)
        });

        const responseText = await response.text();
        console.log('[Push] Najva response status:', response.status);
        console.log('[Push] Najva response:', responseText);
        
        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            console.log('[Push] ✓ Najva notification sent:', result);
            pushSent = true;
          } catch {
            console.log('[Push] ✓ Najva notification sent (non-JSON response)');
            pushSent = true;
          }
        } else {
          console.error('[Push] Najva error - Status:', response.status, 'Response:', responseText);
        }
      } catch (najvaError) {
        console.error('[Push] Najva request failed:', najvaError);
      }
    } else {
      console.log('[Push] Najva not fully configured - Token:', !!najvaApiToken, 'ApiKey:', !!najvaApiKey);
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
