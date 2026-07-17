// Diagnostic edge function for Najva push delivery.
// Usage:
//   supabase.functions.invoke('najva-diagnose', { body: { user_id: '<uuid>' } })
//   supabase.functions.invoke('najva-diagnose', { body: { subscriber_token: '<token>' } })
//
// Logs every step (env presence, token lookup, request payload, HTTP status,
// raw response body) so you can pinpoint exactly why Najva rejects delivery.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Najva has published a few different base URLs over time. We try them in
// order and log every attempt so you can see which one your account accepts.
const NAJVA_ENDPOINTS = [
  "https://app.najva.com/api/v1/notifications",
  "https://app.najva.com/notification/api/v1/notifications",
  "https://app.najva.com/api/notifications/v1/notifications/",
  "https://www.najva.com/api/v1/notifications/",
  "https://www.najva.com/api/notifications/v1/notifications/",
  "https://www.najva.com/notification/api/v1/notifications/",
  "https://panel.najva.com/api/v1/notifications/",
  "https://api.najva.com/api/v1/notifications/",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const log: any[] = [];
  const push = (step: string, data: unknown = {}) => {
    const entry = { step, ...(typeof data === "object" ? data : { data }) };
    console.log("[najva-diagnose]", JSON.stringify(entry));
    log.push(entry);
  };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const NAJVA_API_TOKEN = Deno.env.get("NAJVA_API_TOKEN");
    const NAJVA_API_KEY = Deno.env.get("NAJVA_API_KEY");

    push("env", {
      hasToken: !!NAJVA_API_TOKEN,
      tokenLen: NAJVA_API_TOKEN?.length || 0,
      hasApiKey: !!NAJVA_API_KEY,
      apiKeyLen: NAJVA_API_KEY?.length || 0,
    });

    if (!NAJVA_API_TOKEN || !NAJVA_API_KEY) {
      return json(
        { ok: false, error: "Najva secrets missing", log },
        500,
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      user_id,
      subscriber_token,
      phone_number,
      broadcast = false,
      title = "تست نجوا",
      body: msgBody = "این یک پیام تشخیصی است",
      url = "https://ahrom.ir/",
    } = body || {};

    push("input", { user_id, phone_number, hasToken: !!subscriber_token, broadcast, title });

    // Resolve tokens
    let tokens: string[] = [];
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    if (subscriber_token) {
      tokens = [subscriber_token];
    } else if (phone_number) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone_number", phone_number)
        .maybeSingle();
      push("phone_lookup", { user_id: prof?.user_id });
      if (prof?.user_id) {
        const { data, error } = await supabase
          .from("najva_subscriptions")
          .select("subscriber_token, created_at")
          .eq("user_id", prof.user_id);
        push("lookup", { error: error?.message, count: data?.length || 0 });
        tokens = (data || []).map((r: any) => r.subscriber_token).filter(Boolean);
      }
    } else if (user_id) {
      const { data, error } = await supabase
        .from("najva_subscriptions")
        .select("subscriber_token, created_at")
        .eq("user_id", user_id);
      push("lookup", { error: error?.message, count: data?.length || 0, rows: data });
      tokens = (data || []).map((r: any) => r.subscriber_token).filter(Boolean);
    }

    if (!broadcast && tokens.length === 0) {
      return json(
        { ok: false, error: "No subscriber_token for this user. Try broadcast:true to send to all site subscribers.", log },
        404,
      );
    }

    const payload: Record<string, unknown> = {
      api_key: NAJVA_API_KEY,
      title,
      body: msgBody,
      onclick_action: 0,
      url,
      icon: "https://ahrom.ir/icons/icon-512-v3.png",
      sent_time: new Date().toISOString().replace("Z", "").split(".")[0],
    };
    if (tokens.length > 0) {
      payload.subscriber_tokens = tokens;
    }

    push("payload", { ...payload, api_key: "***", subscriber_tokens: tokens.length, mode: tokens.length ? "targeted" : "broadcast" });

    const attempts: any[] = [];
    for (const endpoint of NAJVA_ENDPOINTS) {
      try {
        const started = Date.now();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${NAJVA_API_TOKEN}`,
          },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        const attempt = {
          endpoint,
          status: res.status,
          ok: res.ok,
          ms: Date.now() - started,
          response: safeParse(text),
          rawSnippet: text.slice(0, 500),
        };
        push("najva_response", attempt);
        attempts.push(attempt);
        if (res.ok || res.status === 201) {
          return json({ ok: true, endpoint, attempts, log }, 200);
        }
      } catch (e) {
        const err = { endpoint, error: (e as Error).message };
        push("najva_error", err);
        attempts.push(err);
      }
    }

    return json({ ok: false, error: "All Najva endpoints failed", attempts, log }, 502);
  } catch (e) {
    push("fatal", { error: (e as Error).message });
    return json({ ok: false, error: (e as Error).message, log }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function safeParse(t: string) {
  try { return JSON.parse(t); } catch { return null; }
}
