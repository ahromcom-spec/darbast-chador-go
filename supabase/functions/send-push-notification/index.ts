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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, title, body, link, type, callData } = await req.json();

    console.log('[Push] Request for user:', user_id, 'Type:', type);

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create in-app notification - this is the reliable method
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

    // For incoming calls, users will be notified via:
    // 1. Supabase Realtime (voice_call_signals table) - works when app is open
    // 2. In-app notifications - visible when user returns to app
    // Note: True background push requires native app or complex VAPID setup

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification created',
        inAppCreated: !notifError
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
