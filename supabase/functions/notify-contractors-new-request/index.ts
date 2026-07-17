import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  scaffolding: "داربست",
  tarpaulin: "چادر و برزنت",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const serviceRequestId: string | undefined =
      body.service_request_id || body.serviceRequestId;

    if (!serviceRequestId) {
      return new Response(
        JSON.stringify({ error: "service_request_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load service request
    const { data: sr, error: srErr } = await supabase
      .from("service_requests")
      .select("id, user_id, service_type, sub_type, location_address, created_at")
      .eq("id", serviceRequestId)
      .maybeSingle();

    if (srErr || !sr) {
      console.error("[notify-contractors] service request not found", srErr);
      return new Response(
        JSON.stringify({ error: "service_request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Customer name
    let customerName = "مشتری";
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", sr.user_id)
      .maybeSingle();
    if (prof?.full_name) customerName = prof.full_name;

    // Find contractors with an APPROVED service matching this service_type
    const { data: services, error: svcErr } = await supabase
      .from("contractor_services")
      .select("contractor_id")
      .eq("service_type", sr.service_type)
      .eq("status", "approved");

    if (svcErr) {
      console.error("[notify-contractors] error fetching services", svcErr);
      return new Response(
        JSON.stringify({ error: "error fetching services" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contractorIds = [...new Set((services ?? []).map((s: any) => s.contractor_id))];
    if (contractorIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: "no matching contractors" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to approved + active contractors and get phone numbers
    const { data: contractors, error: cErr } = await supabase
      .from("contractors")
      .select("id, phone_number, company_name")
      .in("id", contractorIds)
      .eq("is_approved", true)
      .eq("is_active", true);

    if (cErr) {
      console.error("[notify-contractors] error fetching contractors", cErr);
      return new Response(
        JSON.stringify({ error: "error fetching contractors" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!contractors || contractors.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceLabel = SERVICE_TYPE_LABELS[sr.service_type] || sr.service_type;
    const orderCode = `SR-${String(sr.id).slice(0, 8).toUpperCase()}`;
    const address = sr.location_address || "ثبت نشده";

    console.log(
      `[notify-contractors] Notifying ${contractors.length} contractor(s) for ${sr.service_type} (${serviceRequestId})`
    );

    // Fire SMS in parallel via send-order-sms
    const results = await Promise.allSettled(
      contractors.map((c: any) =>
        supabase.functions.invoke("send-order-sms", {
          body: {
            phone: c.phone_number,
            orderCode,
            orderId: sr.id,
            status: "contractor_pending_request",
            serviceType: serviceLabel,
            address,
            customerName,
          },
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;
    console.log(`[notify-contractors] sent=${sent} failed=${failed}`);

    return new Response(
      JSON.stringify({ success: true, notified: sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[notify-contractors] error", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
