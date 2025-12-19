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

    const { order_code, order_id, customer_name, customer_phone, service_type, orderCode, orderId, customerName, address, messageType } = await req.json();

    // Support both naming conventions
    const finalOrderCode = order_code || orderCode;
    const finalOrderId = order_id || orderId;
    const finalCustomerName = customer_name || customerName;

    console.log('[NotifyManagers] Notification request:', { orderCode: finalOrderCode, orderId: finalOrderId, customerName: finalCustomerName, messageType });

    if (!finalOrderCode || !finalOrderId) {
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

    // Determine message content based on messageType
    let title: string;
    let body: string;
    let link: string;

    if (messageType === 'expert_price_confirmed') {
      title = `✓ تایید قیمت سفارش ${finalOrderCode}`;
      body = `مشتری ${finalCustomerName || 'ناشناس'} قیمت سفارش را تایید کرد. سفارش آماده تایید نهایی و اجرا است.`;
      link = `/executive/pending?orderId=${finalOrderId}`;
    } else {
      // Default: new order notification
      title = `سفارش جدید ${finalOrderCode}`;
      body = `سفارش جدید از ${finalCustomerName || 'مشتری'} ${customer_phone ? `(${customer_phone})` : ''} ثبت شد. ${service_type || ''}`.trim();
      link = `/sales/pending`;
    }

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

    // ارسال Push Notification با Najva
    let pushSent = false;
    if (najvaApiToken && najvaApiKey) {
      try {
        console.log('[NotifyManagers] Sending Najva push notification');
        console.log('[NotifyManagers] Using API Key:', najvaApiKey.substring(0, 8) + '...');
        
        const notificationData: Record<string, unknown> = {
          api_key: najvaApiKey,
          title,
          body,
          onclick_action: 0, // open-link
          url: `https://ahrom.ir${link}`,
          icon: 'https://ahrom.ir/icon-512.png',
        };

        console.log('[NotifyManagers] Najva request data:', JSON.stringify(notificationData));

        const response = await fetch('https://app.najva.com/api/v1/notifications/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${najvaApiToken}`,
          },
          body: JSON.stringify(notificationData),
        });

        const responseText = await response.text();
        console.log('[NotifyManagers] Najva response status:', response.status);
        console.log('[NotifyManagers] Najva response:', responseText);
        
        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            console.log('[NotifyManagers] ✓ Najva push sent successfully:', result);
            pushSent = true;
          } catch {
            console.log('[NotifyManagers] ✓ Najva push sent (non-JSON response)');
            pushSent = true;
          }
        } else {
          console.error('[NotifyManagers] Najva error - Status:', response.status, 'Response:', responseText);
        }
      } catch (najvaError) {
        console.error('[NotifyManagers] Najva request failed:', najvaError);
      }
    } else {
      console.log('[NotifyManagers] Najva not fully configured - Token:', !!najvaApiToken, 'ApiKey:', !!najvaApiKey);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Managers notified',
        managersNotified: uniqueManagerIds.length,
        inAppCreated: !notifError,
        pushSent
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
