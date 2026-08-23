import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: due, error } = await supabase
      .from("scheduled_sms")
      .select("*")
      .eq("state", "pending")
      .lte("send_after", new Date().toISOString())
      .order("send_after", { ascending: true })
      .limit(25);

    if (error) throw error;

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const row of due ?? []) {
      // قفل کردن رکورد تا ارسال تکراری انجام نشود
      const { data: locked } = await supabase
        .from("scheduled_sms")
        .update({ state: "sending", attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id)
        .eq("state", "pending")
        .select("id")
        .maybeSingle();

      if (!locked) continue;

      const payload = (row.payload ?? {}) as Record<string, unknown>;

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-order-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            ...payload,
            phone: row.phone,
            orderCode: row.order_code,
            orderId: row.order_id ?? undefined,
            status: row.status_key,
            bypassWindow: true,
          }),
        });

        const text = await res.text();
        if (!res.ok) {
          console.error(`[dispatch-scheduled-sms] send failed [${res.status}]: ${text}`);
          await supabase
            .from("scheduled_sms")
            .update({
              state: (row.attempts ?? 0) + 1 >= 3 ? "failed" : "pending",
              last_error: `${res.status}: ${text.slice(0, 300)}`,
            })
            .eq("id", row.id);
          results.push({ id: row.id, ok: false, error: `${res.status}` });
          continue;
        }

        await supabase
          .from("scheduled_sms")
          .update({ state: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", row.id);
        results.push({ id: row.id, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[dispatch-scheduled-sms] exception: ${msg}`);
        await supabase
          .from("scheduled_sms")
          .update({
            state: (row.attempts ?? 0) + 1 >= 3 ? "failed" : "pending",
            last_error: msg.slice(0, 300),
          })
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dispatch-scheduled-sms] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
