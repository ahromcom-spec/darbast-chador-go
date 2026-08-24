import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function recomputeOrderTotalPaid(supabaseClient: any, orderId: string) {
  const { data: allPayments } = await supabaseClient
    .from('order_payments')
    .select('amount')
    .eq('order_id', orderId);
  const newTotalPaid = (allPayments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const { data: ord } = await supabaseClient
    .from('projects_v3')
    .select('total_price, payment_amount')
    .eq('id', orderId)
    .single();
  const totalPrice = Number(ord?.total_price ?? ord?.payment_amount ?? 0);
  const isFullyPaid = totalPrice > 0 && newTotalPaid >= totalPrice;

  const updateData: any = { total_paid: newTotalPaid };
  if (isFullyPaid) {
    updateData.payment_confirmed_at = new Date().toISOString();
    updateData.status = 'paid';
  }
  await supabaseClient.from('projects_v3').update(updateData).eq('id', orderId);
  return { newTotalPaid, totalPrice, isFullyPaid };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    let authority: string | null = null;
    let status: string | null = null;
    let order_id: string | null = null;
    let statement_id: string | null = null;
    let pay_all = false;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        authority = body.Authority ?? body.authority ?? null;
        status = body.Status ?? body.status ?? null;
        order_id = body.order_id ?? null;
        statement_id = body.statement_id ?? null;
        pay_all = body.pay_all === true || body.pay_all === '1';
      } catch (parseError) {
        console.error('Error parsing JSON body:', parseError);
      }
    }

    if (!authority || !order_id) {
      authority = authority ?? url.searchParams.get('Authority');
      status = status ?? url.searchParams.get('Status');
      order_id = order_id ?? url.searchParams.get('order_id');
      statement_id = statement_id ?? url.searchParams.get('statement_id');
    }
    if (!pay_all) pay_all = url.searchParams.get('pay_all') === '1';

    console.log('Verify callback:', { authority, status, order_id, statement_id, pay_all });


    if (!authority || !order_id) {
      throw new Error('Missing required parameters');
    }

    if (status !== 'OK') {
      return new Response(
        JSON.stringify({ success: false, status: 'cancelled', order_id, statement_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: order, error: orderError } = await supabaseClient
      .from('projects_v3')
      .select('id, payment_amount, total_price, total_paid, customer_id, statement_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    // Look up requested amount from audit_log (payment_requested)
    let requestedAmount = 0;
    const { data: auditRow } = await supabaseClient
      .from('audit_log')
      .select('meta')
      .eq('entity', 'payment')
      .eq('action', 'payment_requested')
      .contains('meta', { authority })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (auditRow?.meta) {
      requestedAmount = Number((auditRow.meta as any).amount) || 0;
      if (!statement_id) statement_id = (auditRow.meta as any).statement_id || null;
      if (!pay_all) pay_all = (auditRow.meta as any).pay_all === true;
    }


    const ZARINPAL_MERCHANT_ID = '93f06023-423a-44d6-ac08-8ee0aa9ed257';
    const ZARINPAL_VERIFY_URL = 'https://api.zarinpal.com/pg/v4/payment/verify.json';

    // Candidate amounts (Toman): the requested amount is authoritative, but if it
    // is missing (e.g. the request log was not saved) we try the remaining amount
    // and the full order price so a real partial payment is never lost (error -50).
    const totalPriceToman = Number(order.total_price ?? order.payment_amount ?? 0);
    const remainingToman = Math.max(totalPriceToman - Number(order.total_paid ?? 0), 0);
    const candidates = [requestedAmount, remainingToman, totalPriceToman]
      .map((n) => Math.round(Number(n) || 0))
      .filter((n) => n > 0)
      .filter((n, i, arr) => arr.indexOf(n) === i);

    let verifyData: any = null;
    for (const candidate of candidates) {
      const verifyResponse = await fetch(ZARINPAL_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: ZARINPAL_MERCHANT_ID,
          amount: candidate * 10,
          authority,
        }),
      });
      verifyData = await verifyResponse.json();
      console.log('ZarinPal verify response for amount', candidate, verifyData);
      const code = verifyData?.data?.code ?? verifyData?.errors?.code;
      if (code === 100 || code === 101) break;
      if (code !== -50) break; // only amount-mismatch is worth retrying
    }


    const verifyCode = verifyData?.data?.code ?? verifyData?.errors?.code;
    const verifiedRefId = verifyData?.data?.ref_id ?? verifyData?.errors?.ref_id;

    // code 100 = verified now, code 101 = already verified previously.
    // Both mean the money was really paid, so both must be recorded.
    if ((verifyCode === 100 || verifyCode === 101) && verifiedRefId) {
      const refID = verifiedRefId;
      const paidAmount = Math.round(Number(verifyData?.data?.amount ?? 0) / 10)
        || Math.round(requestedAmount)
        || remainingToman;


      // --- Waterfall distribution ---
      // pay_all: across ALL statements of the customer (lowest statement number first)
      // otherwise: across the statement's orders (oldest first)
      const sid = statement_id || order.statement_id;
      let distribution: { order_id: string; amount: number }[] = [];

      const allocate = (list: any[]) => {
        let remainingToAllocate = paidAmount;
        const result: { order_id: string; amount: number }[] = [];
        for (const o of list) {
          if (remainingToAllocate <= 0) break;
          const total = Number(o.total_price ?? o.payment_amount ?? 0);
          const paid = Number(o.total_paid ?? 0);
          const need = Math.max(total - paid, 0);
          const isLast = o.id === list[list.length - 1].id;
          if (need <= 0 && !isLast) continue;
          const give = isLast ? remainingToAllocate : Math.min(need, remainingToAllocate);
          if (give > 0) {
            result.push({ order_id: o.id, amount: give });
            remainingToAllocate -= give;
          }
        }
        return result;
      };

      if (pay_all) {
        const { data: allOrders } = await supabaseClient
          .from('projects_v3')
          .select('id, total_price, payment_amount, total_paid, created_at, statement_id, customer_statements(statement_number)')
          .eq('customer_id', order.customer_id)
          .neq('status', 'rejected')
          .or('is_archived.is.null,is_archived.eq.false')
          .or('is_deep_archived.is.null,is_deep_archived.eq.false');

        const ordered = (allOrders || []).sort((a: any, b: any) => {
          const sa = Number(a.customer_statements?.statement_number ?? Number.MAX_SAFE_INTEGER);
          const sb = Number(b.customer_statements?.statement_number ?? Number.MAX_SAFE_INTEGER);
          if (sa !== sb) return sa - sb;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        distribution = ordered.length > 0 ? allocate(ordered) : [];
        if (distribution.length === 0) {
          distribution.push({ order_id: order_id!, amount: paidAmount });
        }
      } else if (sid) {
        const { data: stmtOrders } = await supabaseClient
          .from('projects_v3')
          .select('id, total_price, payment_amount, total_paid, created_at')
          .eq('statement_id', sid)
          .neq('status', 'rejected')
          .order('created_at', { ascending: true });

        distribution = allocate(stmtOrders || []);

        // Safety: if nothing was distributed, put everything on the primary order
        if (distribution.length === 0) {
          distribution.push({ order_id: order_id!, amount: paidAmount });
        }
      } else {
        distribution.push({ order_id: order_id!, amount: paidAmount });
      }


      // Insert order_payments rows (idempotent per ZarinPal ref id)
      const { data: existingPays } = await supabaseClient
        .from('order_payments')
        .select('id')
        .eq('receipt_number', refID.toString());
      const alreadyRecorded = (existingPays || []).length > 0;

      if (!alreadyRecorded) {
        for (const d of distribution) {
          const isPrimary = d.order_id === order_id;
          const { error: payErr } = await supabaseClient.from('order_payments').insert({
            order_id: d.order_id,
            paid_by: order.customer_id,
            amount: d.amount,
            payment_method: 'zarinpal',
            receipt_number: refID.toString(),
            notes: isPrimary
              ? `پرداخت آنلاین زرین‌پال - کد پیگیری: ${refID}`
              : `سرریز پرداخت صورتحساب - کد پیگیری: ${refID}`,
            payment_date: new Date().toISOString(),
          });
          if (payErr) console.error('Failed to insert order_payment:', payErr);
        }
      }


      // Recompute totals on each affected order
      for (const d of distribution) {
        await recomputeOrderTotalPaid(supabaseClient, d.order_id);
      }

      // Set transaction_reference and payment_method on the primary order
      await supabaseClient
        .from('projects_v3')
        .update({
          payment_method: 'zarinpal',
          transaction_reference: refID.toString(),
        })
        .eq('id', order_id);

      const { data: primaryOrderAfter } = await supabaseClient
        .from('projects_v3')
        .select('total_paid, total_price, payment_amount')
        .eq('id', order_id)
        .single();
      const primaryTotalPrice = Number(primaryOrderAfter?.total_price ?? primaryOrderAfter?.payment_amount ?? 0);
      const primaryTotalPaid = Number(primaryOrderAfter?.total_paid ?? 0);
      const isFullyPaid = primaryTotalPrice > 0 && primaryTotalPaid >= primaryTotalPrice;

      await supabaseClient.from('audit_log').insert({
        entity: 'payment',
        entity_id: order_id,
        action: 'payment_verified',
        meta: {
          authority,
          ref_id: refID,
          amount: paidAmount,
          statement_id: sid,
          distribution,
          pay_all,

        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'success',
          order_id,
          statement_id: sid,
          ref_id: refID,
          amount: paidAmount,
          distribution,
          is_fully_paid: isFullyPaid,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (verifyData.data && verifyData.data.code === 101) {
      return new Response(
        JSON.stringify({ success: true, status: 'already_verified', order_id, statement_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('Payment verification failed:', verifyData);
      await supabaseClient.from('audit_log').insert({
        entity: 'payment',
        entity_id: order_id,
        action: 'payment_failed',
        meta: { authority, error: verifyData.errors || 'Unknown error' },
      });
      return new Response(
        JSON.stringify({ success: false, status: 'failed', order_id, statement_id, error: verifyData.errors ?? 'Payment verification failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Verify error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
