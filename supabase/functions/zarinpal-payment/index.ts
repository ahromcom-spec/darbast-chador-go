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
      .select('id, customer_id, status, payment_confirmed_at')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'approved') {
      throw new Error('Order is not approved for payment');
    }

    if (order.payment_confirmed_at) {
      throw new Error('Order has already been paid');
    }

    // Verify order belongs to user
    const { data: customer } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!customer || customer.id !== order.customer_id) {
      throw new Error('Order does not belong to user');
    }

    // ZarinPal configuration
    const ZARINPAL_MERCHANT_ID = '93f06023-423a-44d6-ac08-8ee0aa9ed257';
    const ZARINPAL_API_URL = 'https://api.zarinpal.com/pg/v4/payment/request.json';
    const CALLBACK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/zarinpal-verify`;

    // Request payment from ZarinPal
    const zarinpalResponse = await fetch(ZARINPAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: ZARINPAL_MERCHANT_ID,
        amount: amount * 10, // Convert Toman to Rial (multiply by 10)
        description: description || 'پرداخت سفارش',
        callback_url: `${CALLBACK_URL}?order_id=${order_id}`,
        metadata: {
          order_id: order_id,
          user_id: user.id,
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
