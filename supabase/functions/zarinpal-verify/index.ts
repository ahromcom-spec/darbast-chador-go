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
    const url = new URL(req.url);

    // پشتیبانی از هر دو حالت: callback مستقیم (GET) و فراخوانی از فرانت (POST JSON)
    let authority: string | null = null;
    let status: string | null = null;
    let order_id: string | null = null;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        authority = body.Authority ?? body.authority ?? null;
        status = body.Status ?? body.status ?? null;
        order_id = body.order_id ?? null;
      } catch (parseError) {
        console.error('Error parsing JSON body:', parseError);
      }
    }

    // در صورت نبودن body معتبر، از query string استفاده کن (حالت قدیمی)
    if (!authority || !order_id) {
      authority = authority ?? url.searchParams.get('Authority');
      status = status ?? url.searchParams.get('Status');
      order_id = order_id ?? url.searchParams.get('order_id');
    }

    console.log('Verify callback:', { authority, status, order_id });

    if (!authority || !order_id) {
      throw new Error('Missing required parameters');
    }

    // اگر کاربر از درگاه برگشته ولی پرداخت را لغو کرده باشد
    if (status !== 'OK') {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'cancelled',
          order_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('projects_v3')
      .select('id, payment_amount, total_price, total_paid, customer_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // ZarinPal configuration
    const ZARINPAL_MERCHANT_ID = '93f06023-423a-44d6-ac08-8ee0aa9ed257';
    const ZARINPAL_VERIFY_URL = 'https://api.zarinpal.com/pg/v4/payment/verify.json';

    // Verify payment with ZarinPal
    const verifyResponse = await fetch(ZARINPAL_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: ZARINPAL_MERCHANT_ID,
        amount: order.payment_amount * 10, // Convert Toman to Rial
        authority: authority,
      }),
    });

    const verifyData = await verifyResponse.json();

    console.log('ZarinPal verify response:', verifyData);

    if (verifyData.data && verifyData.data.code === 100) {
      // Payment successful
      const refID = verifyData.data.ref_id;
      // مبلغ واقعی پرداخت شده از زرین‌پال (ریال به تومان)
      const paidAmount = Math.round(verifyData.data.amount / 10);
      
      // ثبت پرداخت در جدول order_payments
      const { error: paymentInsertError } = await supabaseClient
        .from('order_payments')
        .insert({
          order_id: order_id,
          paid_by: order.customer_id,
          amount: paidAmount,
          payment_method: 'zarinpal',
          receipt_number: refID.toString(),
          notes: `پرداخت آنلاین زرین‌پال - کد پیگیری: ${refID}`,
          payment_date: new Date().toISOString(),
        });

      if (paymentInsertError) {
        console.error('Error inserting order_payment:', paymentInsertError);
      }

      // محاسبه مجموع پرداخت‌ها
      const { data: allPayments } = await supabaseClient
        .from('order_payments')
        .select('amount')
        .eq('order_id', order_id);
      
      const newTotalPaid = (allPayments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      
      // بررسی تسویه کامل
      const totalPrice = order.total_price || order.payment_amount || 0;
      const isFullyPaid = newTotalPaid >= totalPrice && totalPrice > 0;

      // Update order
      const updateData: any = {
        payment_method: 'zarinpal',
        transaction_reference: refID.toString(),
        total_paid: newTotalPaid,
      };
      
      // فقط در صورت تسویه کامل payment_confirmed_at را ست کن
      if (isFullyPaid) {
        updateData.payment_confirmed_at = new Date().toISOString();
        updateData.status = 'paid';
      }

      const { error: updateError } = await supabaseClient
        .from('projects_v3')
        .update(updateData)
        .eq('id', order_id);

      if (updateError) {
        console.error('Error updating order:', updateError);
      }

      // Log successful payment
      await supabaseClient.from('audit_log').insert({
        entity: 'payment',
        entity_id: order_id,
        action: 'payment_verified',
        meta: {
          authority: authority,
          ref_id: refID,
          amount: paidAmount,
          total_paid: newTotalPaid,
          is_fully_paid: isFullyPaid,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'success',
          order_id,
          ref_id: refID,
          total_paid: newTotalPaid,
          is_fully_paid: isFullyPaid,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (verifyData.data && verifyData.data.code === 101) {
      // Payment already verified
      return new Response(
        JSON.stringify({
          success: true,
          status: 'already_verified',
          order_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Payment verification failed
      console.error('Payment verification failed:', verifyData);
      
      // Log failed payment
      await supabaseClient.from('audit_log').insert({
        entity: 'payment',
        entity_id: order_id,
        action: 'payment_failed',
        meta: {
          authority: authority,
          error: verifyData.errors || 'Unknown error',
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'failed',
          order_id,
          error: verifyData.errors ?? 'Payment verification failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Verify error:', error);
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
