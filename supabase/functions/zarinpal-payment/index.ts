import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const gatewayUnavailableMessage = 'درگاه پرداخت زرین‌پال در حال حاضر در دسترس نیست. لطفاً چند دقیقه دیگر دوباره تلاش کنید.';
const ZARINPAL_DIRECT_PAYMENT_LINK = 'https://shop.ahrom.ir/link';

const isZarinpalNetworkError = (message: string) =>
  /api\.zarinpal\.com|ETIMEDOUT|AbortError|Connection timed out|tcp connect error|NETWORK_ERROR/i.test(message);

serve(async (req) => {
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

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const { amount, description } = body;
    let { order_id } = body;
    const statement_id: string | undefined = body.statement_id;
    const pay_all: boolean = body.pay_all === true;

    if (!amount || amount <= 0) {
      throw new Error('Missing required field: amount');
    }
    if (!order_id && !statement_id && !pay_all) {
      throw new Error('Missing required field: order_id or statement_id');
    }

    // Verify customer
    const { data: customer } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // مشتری ممکن است وجود نداشته باشد (همکار سفارش) — در ادامه با دسترسی همکاری بررسی می‌شود
    if (!customer && (pay_all || statement_id)) throw new Error('Customer not found');

    const payableStatuses = ['pending', 'pending_execution', 'approved', 'completed', 'in_progress', 'paid'];

    // --- Global payment across ALL statements: pick the oldest unsettled order
    // of the lowest statement number (waterfall entry point) ---
    if (pay_all && !order_id) {
      const { data: allOrders, error: allErr } = await supabaseClient
        .from('projects_v3')
        .select('id, status, total_price, payment_amount, total_paid, created_at, statement_id, customer_statements(statement_number)')
        .eq('customer_id', customer.id)
        .neq('status', 'rejected')
        .or('is_archived.is.null,is_archived.eq.false')
        .or('is_deep_archived.is.null,is_deep_archived.eq.false');
      if (allErr) throw allErr;

      const sorted = (allOrders || [])
        .filter((o: any) => payableStatuses.includes(o.status))
        .sort((a: any, b: any) => {
          const sa = Number(a.customer_statements?.statement_number ?? Number.MAX_SAFE_INTEGER);
          const sb = Number(b.customer_statements?.statement_number ?? Number.MAX_SAFE_INTEGER);
          if (sa !== sb) return sa - sb;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

      const target = sorted.find((o: any) => {
        const total = Number(o.total_price ?? o.payment_amount ?? 0);
        return total - Number(o.total_paid ?? 0) > 0;
      }) || sorted[0];

      if (!target) throw new Error('No payable order found');
      order_id = target.id;
    }

    // --- Statement-level payment: pick oldest unsettled order in the statement ---

    if (statement_id) {
      // Verify statement belongs to customer
      const { data: stmt, error: stmtErr } = await supabaseClient
        .from('customer_statements')
        .select('id, customer_id, status')
        .eq('id', statement_id)
        .single();
      if (stmtErr || !stmt) throw new Error('Statement not found');
      if (stmt.customer_id !== customer.id) throw new Error('Statement does not belong to user');

      // Pick oldest order in the statement that still has remaining
      const { data: stmtOrders, error: oErr } = await supabaseClient
        .from('projects_v3')
        .select('id, code, status, total_price, payment_amount, total_paid')
        .eq('statement_id', statement_id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: true });
      if (oErr) throw oErr;

      const allowedStatuses = ['pending', 'pending_execution', 'approved', 'completed', 'in_progress', 'paid'];
      const candidate = (stmtOrders || []).find((o: any) => {
        const total = Number(o.total_price ?? o.payment_amount ?? 0);
        const paid = Number(o.total_paid ?? 0);
        return total - paid > 0 && allowedStatuses.includes(o.status);
      }) || (stmtOrders || []).find((o: any) => allowedStatuses.includes(o.status));

      if (!candidate) throw new Error('No payable order in this statement');
      order_id = candidate.id;
    }

    // Verify order
    const { data: order, error: orderError } = await supabaseClient
      .from('projects_v3')
      .select('id, customer_id, status, payment_confirmed_at, code, payment_amount, total_paid, notes')
      .eq('id', order_id)
      .single();

    if (orderError || !order) throw new Error('Order not found');
    if (!customer || order.customer_id !== customer.id) {
      // Allow accepted collaborators with financial access to pay for the order
      const { data: collab } = await supabaseClient
        .from('order_collaborators')
        .select('id, can_view_financials')
        .eq('order_id', order.id)
        .eq('invitee_user_id', user.id)
        .in('status', ['accepted', 'approved'])
        .maybeSingle();
      if (!collab) throw new Error('Order does not belong to user');
      if ((collab as any).can_view_financials === false) {
        throw new Error('Collaborator does not have payment access');
      }
    }

    const allowedStatuses = ['pending', 'pending_execution', 'approved', 'completed', 'in_progress', 'paid'];
    if (!allowedStatuses.includes(order.status)) {
      throw new Error('Order status does not allow payment');
    }

    // For statement payments we explicitly allow over-payment of the single order
    // (overflow waterfalls to the next orders in the statement during verify).
    if (!statement_id && !pay_all) {
      let estimatedPrice = 0;
      try {
        const notesObj = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
        estimatedPrice = notesObj?.estimated_price || notesObj?.estimatedPrice || notesObj?.total_price || notesObj?.manager_set_price || 0;
      } catch (_) {}
      const totalPrice = order.payment_amount || estimatedPrice || 0;
      const remainingAmount = totalPrice - (order.total_paid || 0);
      if (remainingAmount <= 0) throw new Error('Order has already been paid');
    }

    // Get user profile for better description
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, phone_number')
      .eq('user_id', user.id)
      .single();

    const customerName = profile?.full_name || 'نامشخص';
    const customerPhone = profile?.phone_number || '';
    const orderCode = order.code || order_id!.substring(0, 8);

    const paymentDescription = description
      || (pay_all
        ? `پرداخت کل صورتحساب‌ها - ${customerName}${customerPhone ? ` - ${customerPhone}` : ''}`
        : statement_id
        ? `پرداخت صورتحساب - ${customerName}${customerPhone ? ` - ${customerPhone}` : ''}`
        : `سفارش ${orderCode} - ${customerName}${customerPhone ? ` - ${customerPhone}` : ''}`);


    const ZARINPAL_MERCHANT_ID = '93f06023-423a-44d6-ac08-8ee0aa9ed257';
    const ZARINPAL_API_URLS = [
      'https://api.zarinpal.com/pg/v4/payment/request.json',
      'https://payment.zarinpal.com/pg/v4/payment/request.json',
    ];
    const CALLBACK_URL = 'https://ahrom.ir/payment/zarinpal-callback';

    const callbackQuery = new URLSearchParams({ order_id: order_id! });
    if (statement_id) callbackQuery.set('statement_id', statement_id);
    if (pay_all) callbackQuery.set('pay_all', '1');


    // Add timeout + retry to avoid hanging when ZarinPal API is slow/unreachable
    const callZarinpal = async (apiUrl: string, timeoutMs: number) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchant_id: ZARINPAL_MERCHANT_ID,
            amount: amount * 10,
            description: paymentDescription,
            callback_url: `${CALLBACK_URL}?${callbackQuery.toString()}`,
            metadata: {
              order_id,
              statement_id: statement_id || null,
              user_id: user.id,
              customer_name: customerName,
              customer_phone: customerPhone,
              order_code: orderCode,
            }
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    };

    let zarinpalResponse: Response | null = null;
    let lastErr: any = null;
    // Race both ZarinPal endpoints in parallel with a short timeout for the
    // fastest possible connection to the payment gateway.
    try {
      zarinpalResponse = await Promise.any(
        ZARINPAL_API_URLS.map((apiUrl) => callZarinpal(apiUrl, 5000))
      );
    } catch (err: any) {
      lastErr = err?.errors?.[0] ?? err;
      console.warn('ZarinPal parallel attempts failed:', lastErr);
    }
    if (!zarinpalResponse) {
      const code = (lastErr as any)?.code || (lastErr as any)?.name || 'NETWORK_ERROR';
      console.error('ZarinPal unreachable after retries:', lastErr);
      return new Response(
        JSON.stringify({
          success: true,
          fallback: true,
          payment_url: ZARINPAL_DIRECT_PAYMENT_LINK,
          message: 'اتصال مستقیم API زرین‌پال برقرار نشد؛ کاربر به لینک پرداخت سریع زرین‌پال هدایت شد.',
          code,
          order_id,
          statement_id: statement_id || null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const zarinpalData = await zarinpalResponse.json();
    console.log('ZarinPal response:', zarinpalData);

    if (zarinpalData.data && zarinpalData.data.code === 100) {
      const authority = zarinpalData.data.authority;
      const paymentUrl = `https://www.zarinpal.com/pg/StartPay/${authority}`;

      // IMPORTANT: audit_log inserts are blocked for end users by RLS.
      // Use the service-role client so the requested amount is always stored,
      // otherwise verify() cannot know the real amount (ZarinPal error -50).
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { error: auditErr } = await serviceClient.from('audit_log').insert({
        entity: 'payment',
        entity_id: order_id,
        action: 'payment_requested',
        actor_user_id: user.id,
        meta: { authority, amount, statement_id: statement_id || null, pay_all },
      });
      if (auditErr) console.error('Failed to log payment_requested:', auditErr);


      return new Response(
        JSON.stringify({ success: true, payment_url: paymentUrl, authority, order_id, statement_id: statement_id || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(`ZarinPal error: ${zarinpalData.errors ? JSON.stringify(zarinpalData.errors) : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const safeMessage = isZarinpalNetworkError(errorMessage) ? gatewayUnavailableMessage : errorMessage;
    return new Response(
      JSON.stringify({ success: false, error: safeMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
