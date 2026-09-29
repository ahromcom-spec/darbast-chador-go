import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// اعمال خودکار تغییر مراحل زمان‌بندی‌شده سفارش‌ها + اطلاع به مشتری
const STAGES: Record<string, { status: string; exec: string | null; idx: number }> = {
  pending: { status: "pending", exec: null, idx: 0 },
  pending_execution: { status: "pending_execution", exec: null, idx: 1 },
  in_progress: { status: "in_progress", exec: null, idx: 2 },
  order_executed: { status: "in_progress", exec: "order_executed", idx: 3 },
  awaiting_payment: { status: "completed", exec: "awaiting_payment", idx: 4 },
  awaiting_collection: { status: "completed", exec: "awaiting_collection", idx: 5 },
  in_collection: { status: "completed", exec: "in_collection", idx: 6 },
  collected: { status: "completed", exec: "collected", idx: 7 },
  closed: { status: "closed", exec: null, idx: 8 },
};

const MESSAGES: Record<string, (c: string) => { title: string; body: string }> = {
  pending: (c) => ({ title: "⏳ سفارش در انتظار تایید", body: `سفارش ${c} به مرحله انتظار تایید بازگشت.` }),
  pending_execution: (c) => ({ title: "✅ سفارش در انتظار اجرا", body: `سفارش ${c} در مرحله انتظار اجرا قرار گرفت.` }),
  in_progress: (c) => ({ title: "🚧 سفارش در حال اجرا", body: `سفارش ${c} وارد مرحله اجرا شد.` }),
  order_executed: (c) => ({ title: "✅ سفارش اجرا شد", body: `سفارش ${c} با موفقیت اجرا شد.` }),
  awaiting_payment: (c) => ({ title: "💳 در انتظار پرداخت", body: `سفارش ${c} اجرا شده و در انتظار پرداخت می‌باشد.` }),
  awaiting_collection: (c) => ({ title: "📦 سفارش در انتظار جمع‌آوری", body: `اجرای سفارش ${c} تکمیل شد. لطفاً تاریخ فک داربست را تعیین کنید.` }),
  in_collection: (c) => ({ title: "🔧 داربست در حال جمع‌آوری", body: `جمع‌آوری داربست سفارش ${c} آغاز شده است.` }),
  collected: (c) => ({ title: "✓ داربست جمع‌آوری شد", body: `جمع‌آوری داربست سفارش ${c} تکمیل شد.` }),
  closed: (c) => ({ title: "🎉 سفارش تکمیل شد", body: `سفارش ${c} با موفقیت به اتمام رسید.` }),
};

const SMS_STATUS: Record<string, string> = {
  pending_execution: "approved", in_progress: "in_progress", order_executed: "executed",
  awaiting_payment: "awaiting_payment", awaiting_collection: "awaiting_collection",
  in_collection: "in_collection", collected: "collected", closed: "completed",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  try {
    const { data: due, error } = await sb
      .from("scheduled_stage_changes")
      .select("*")
      .eq("state", "pending")
      .lte("run_at", new Date().toISOString())
      .order("run_at", { ascending: true })
      .limit(20);
    if (error) throw error;

    for (const row of due ?? []) {
      const { data: locked } = await sb
        .from("scheduled_stage_changes")
        .update({ state: "running" })
        .eq("id", row.id).eq("state", "pending")
        .select("id").maybeSingle();
      if (!locked) continue;

      try {
        const stage = STAGES[row.target_stage];
        if (!stage) throw new Error("مرحله نامعتبر");

        const { data: order, error: oErr } = await sb
          .from("projects_v3")
          .select("id, code, status, customer_id, address, detailed_address, approved_at, approved_by, execution_confirmed_at, executive_completion_date")
          .eq("id", row.order_id).single();
        if (oErr || !order) throw new Error("سفارش یافت نشد");

        const now = new Date().toISOString();
        const upd: Record<string, unknown> = {
          status: stage.status,
          execution_stage: stage.exec,
          execution_stage_updated_at: now,
        };
        if (stage.idx === 0) {
          Object.assign(upd, { approved_at: null, approved_by: null, execution_confirmed_at: null, execution_start_date: null, execution_end_date: null, executive_completion_date: null, closed_at: null });
        } else {
          if (!order.approved_at) upd.approved_at = now;
          if (!order.approved_by && row.created_by) upd.approved_by = row.created_by;
          if (stage.idx >= 2 && !order.execution_confirmed_at) upd.execution_confirmed_at = now;
          if (row.target_stage === "closed") {
            upd.closed_at = now;
            if (!order.executive_completion_date) upd.executive_completion_date = now;
          } else upd.closed_at = null;
        }

        const { error: uErr } = await sb.from("projects_v3").update(upd).eq("id", order.id);
        if (uErr) throw uErr;

        if (row.notify_customer && order.customer_id) {
          const { data: cust } = await sb.from("customers").select("user_id").eq("id", order.customer_id).maybeSingle();
          if (cust?.user_id) {
            const msg = MESSAGES[row.target_stage]?.(order.code);
            if (msg) {
              await fetch(`${url}/functions/v1/send-push-notification`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify({ user_id: cust.user_id, order_id: order.id, title: msg.title, body: msg.body, link: `/user/orders/${order.id}`, type: "order-stage" }),
              }).catch((e) => console.error("push failed", e));
            }
            const sms = SMS_STATUS[row.target_stage];
            const { data: prof } = await sb.from("profiles").select("phone_number, full_name").eq("user_id", cust.user_id).maybeSingle();
            if (sms && prof?.phone_number) {
              await fetch(`${url}/functions/v1/send-order-sms`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify({
                  phone: prof.phone_number, orderCode: order.code, orderId: order.id, status: sms,
                  address: [order.address, order.detailed_address].filter(Boolean).join("، "),
                  customerName: prof.full_name,
                }),
              }).catch((e) => console.error("sms failed", e));
            }
          }
        }

        await sb.from("scheduled_stage_changes").update({ state: "done", executed_at: now, last_error: null }).eq("id", row.id);
        results.push({ id: row.id, ok: true });
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[apply-scheduled-stage-changes]", row.id, m);
        await sb.from("scheduled_stage_changes").update({ state: "failed", last_error: m.slice(0, 300) }).eq("id", row.id);
        results.push({ id: row.id, ok: false, error: m });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
