import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user from the auth header
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { order_id, amount, description } = await req.json();

    if (!order_id || !amount) {
      throw new Error('Missing required fields: order_id, amount');
    }

    // Verify order belongs to user and is approved
    const { data: order, error: orderError } = await supabaseClient
      .from('projects_v3')
      .select('id, customer_id, status, payment_confirmed_at, code, payment_amount, total_paid, notes')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // بررسی وضعیت سفارش - اجازه پرداخت برای سفارش‌های معتبر
    // pending: سفارش‌هایی که قیمت کارشناسی دارند و منتظر پرداخت هستند
    // pending_execution: سفارش‌های تایید شده در انتظار اجرا
    // approved, completed, in_progress, paid: سایر وضعیت‌های معتبر
    const allowedStatuses = ['pending', 'pending_execution', 'approved', 'completed', 'in_progress', 'paid'];
    if (!allowedStatuses.includes(order.status)) {
      console.log(`Order ${order_id} has status ${order.status} which is not allowed for payment`);
      throw new Error('Order status does not allow payment');
    }

    // بررسی باقی‌مانده حساب - اگر هنوز مانده دارد، اجازه پرداخت بده
    let estimatedPrice = 0;
    try {
      const notesObj = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
      estimatedPrice = notesObj?.estimated_price || notesObj?.estimatedPrice || notesObj?.total_price || notesObj?.manager_set_price || 0;
    } catch (e) {
      console.log('Could not parse notes for estimated_price');
    }
    
    const totalPrice = order.payment_amount || estimatedPrice || 0;
    const totalPaid = order.total_paid || 0;
    const remainingAmount = totalPrice - totalPaid;

    // فقط اگر واقعاً تسویه شده باشد (مانده صفر یا کمتر) خطا بده
    if (remainingAmount <= 0) {
      throw new Error('Order has already been paid');
    }

    console.log(`Order ${order_id}: totalPrice=${totalPrice}, totalPaid=${totalPaid}, remainingAmount=${remainingAmount}, requestedAmount=${amount}`);

    // Verify order belongs to user
    const { data: customer } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!customer || customer.id !== order.customer_id) {
      throw new Error('Order does not belong to user');
    }

    // Get user profile for better description
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, phone_number')
      .eq('user_id', user.id)
      .single();

    const customerName = profile?.full_name || 'نامشخص';
    const customerPhone = profile?.phone_number || '';
    const orderCode = order.code || order_id.substring(0, 8);

    // Build description with customer info for ZarinPal panel
    const paymentDescription = `سفارش ${orderCode} - ${customerName}${customerPhone ? ` - ${customerPhone}` : ''}`;

    // ZarinPal configuration
    const ZARINPAL_MERCHANT_ID = '93f06023-423a-44d6-ac08-8ee0aa9ed257';
    const ZARINPAL_API_URL = 'https://api.zarinpal.com/pg/v4/payment/request.json';
    
    // توجه: دامنه آدرس بازگشت باید با دامنه ثبت‌شده در زرین‌پال یکی باشد (ahrom.ir)
    const CALLBACK_URL = 'https://ahrom.ir/payment/zarinpal-callback';
 
    // Request payment from ZarinPal
    const zarinpalResponse = await fetch(ZARINPAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: ZARINPAL_MERCHANT_ID,
        amount: amount * 10, // Convert Toman to Rial (multiply by 10)
        description: paymentDescription,
        callback_url: `${CALLBACK_URL}?order_id=${order_id}`,
        metadata: {
          order_id: order_id,
          user_id: user.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          order_code: orderCode,
        }
      }),
    });

    const zarinpalData = await zarinpalResponse.json();

    console.log('ZarinPal response:', zarinpalData);

    if (zarinpalData.data && zarinpalData.data.code === 100) {
      // Success - return payment URL
      const authority = zarinpalData.data.authority;
      const paymentUrl = `https://www.zarinpal.com/pg/StartPay/${authority}`;

      // Log payment request
      await supabaseClient.from('audit_log').insert({
        entity: 'payment',
        entity_id: order_id,
        action: 'payment_requested',
        actor_user_id: user.id,
        meta: {
          authority: authority,
          amount: amount,
        },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          payment_url: paymentUrl,
          authority: authority 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(`ZarinPal error: ${zarinpalData.errors ? JSON.stringify(zarinpalData.errors) : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
