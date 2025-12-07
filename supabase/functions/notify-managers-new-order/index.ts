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

    const { order_code, order_id, customer_name, customer_phone, service_type } = await req.json();

    console.log('[NotifyManagers] New order notification request:', { order_code, order_id, customer_name });

    if (!order_code || !order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: order_code and order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // دریافت لیست مدیران فروش و مدیران عمومی
    const managerRoles = ['sales_manager', 'general_manager', 'admin', 'ceo'];
    
    const { data: managers, error: managersError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', managerRoles);

    if (managersError) {
      console.error('[NotifyManagers] Error fetching managers:', managersError);
      return new Response(
        JSON.stringify({ error: 'Error fetching managers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!managers || managers.length === 0) {
      console.log('[NotifyManagers] No managers found to notify');
      return new Response(
        JSON.stringify({ success: true, message: 'No managers to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // حذف تکراری‌ها (اگر یک کاربر چند نقش داشته باشد)
    const uniqueManagerIds = [...new Set(managers.map(m => m.user_id))];
    console.log('[NotifyManagers] Found', uniqueManagerIds.length, 'unique managers to notify');

    const title = `سفارش جدید ${order_code}`;
    const body = `سفارش جدید از ${customer_name || 'مشتری'} ${customer_phone ? `(${customer_phone})` : ''} ثبت شد. ${service_type || ''}`.trim();
    const link = `/sales/pending`;

    // ایجاد نوتیفیکیشن داخلی برای همه مدیران
    const notifications = uniqueManagerIds.map(user_id => ({
      user_id,
      title,
      body,
      link,
      type: 'info'
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifError) {
      console.error('[NotifyManagers] Error creating notifications:', notifError);
    } else {
      console.log('[NotifyManagers] ✓ In-app notifications created for', uniqueManagerIds.length, 'managers');
    }

    // ارسال Push Notification به همه مدیران
    let pushSentCount = 0;
    if (oneSignalAppId && oneSignalApiKey) {
      try {
        console.log('[NotifyManagers] Sending OneSignal push to', uniqueManagerIds.length, 'managers');
        console.log('[NotifyManagers] Manager IDs:', uniqueManagerIds);
        
        // استفاده از include_aliases به جای include_external_user_ids (deprecated)
        const notificationData = {
          app_id: oneSignalAppId,
          include_aliases: {
            external_id: uniqueManagerIds
          },
          target_channel: "push",
          headings: { fa: title, en: title },
          contents: { fa: body, en: body },
          url: `https://ahrom.org${link}`,
          ttl: 86400, // 24 hours
          priority: 10,
          android_channel_id: 'new_orders',
        };

        console.log('[NotifyManagers] Notification payload:', JSON.stringify(notificationData));

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
          console.log('[NotifyManagers] ✓ OneSignal push sent successfully:', result.id, 'recipients:', result.recipients);
          pushSentCount = result.recipients || uniqueManagerIds.length;
        } else {
          console.error('[NotifyManagers] OneSignal error response:', JSON.stringify(result));
        }
      } catch (oneSignalError) {
        console.error('[NotifyManagers] OneSignal request failed:', oneSignalError);
      }
    } else {
      console.log('[NotifyManagers] OneSignal not configured - AppId:', !!oneSignalAppId, 'ApiKey:', !!oneSignalApiKey);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Managers notified',
        managersNotified: uniqueManagerIds.length,
        inAppCreated: !notifError,
        pushSent: pushSentCount > 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const e = error as Error;
    console.error('[NotifyManagers] Error:', e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
