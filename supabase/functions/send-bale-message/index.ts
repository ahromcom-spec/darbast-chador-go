import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BALE_API = "https://tapi.bale.ai";

const normalizeIranPhone = (input: string) => {
  if (!input) return "";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  let raw = String(input)
    .slice(0, 32)
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[^0-9+]/g, "");
  if (raw.startsWith("0098")) raw = "0" + raw.slice(4);
  else if (raw.startsWith("098")) raw = "0" + raw.slice(3);
  else if (raw.startsWith("+98")) raw = "0" + raw.slice(3);
  else if (raw.startsWith("98")) raw = "0" + raw.slice(2);
  if (raw.length === 10 && raw.startsWith("9")) raw = "0" + raw;
  return raw;
};

interface MediaItem {
  url: string;
  type?: "photo" | "video";
}

interface BaleRequest {
  phone?: string;
  chatId?: string;
  text?: string;
  media?: MediaItem[];
  orderCode?: string;
  orderId?: string;
  force?: boolean; // برای ارسال آزمایشی حتی وقتی غیرفعال است
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body: BaleRequest = await req.json();
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const safirKey = Deno.env.get("BALE_SAFIR_API_KEY");
    const safirBotId = Number(Deno.env.get("BALE_BOT_ID") || 0);
    if (!token && !safirKey) {
      return new Response(JSON.stringify({ error: "توکن ربات بله تنظیم نشده است" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // اتصال ربات: ثبت وب‌هوک بله روی سرور و دریافت اطلاعات ربات
    if ((body as any).action === "setup") {
      const hookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bale-webhook`;
      const setRes = await fetch(`${BALE_API}/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: hookUrl }),
      });
      const setText = (await setRes.text()).slice(0, 500);
      const meRes = await fetch(`${BALE_API}/bot${token}/getMe`);
      const meText = (await meRes.text()).slice(0, 500);
      return new Response(
        JSON.stringify({ success: setRes.ok, webhook: setText, bot: meText, hookUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: settings } = await supabase
      .from("messenger_settings")
      .select("enabled, send_media")
      .eq("provider", "bale")
      .maybeSingle();

    if (!body.force && !settings?.enabled) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "ارسال پیام در بله غیرفعال است" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const text = (body.text || "").toString().trim();
    const phone = body.phone ? normalizeIranPhone(body.phone) : "";

    // شناسه گفتگو: اول از جدول ثبت‌شده، سپس شماره تماس با پیش‌شماره ۹۸
    let chatId = (body.chatId || "").toString().trim();
    let hasRegisteredChat = !!chatId;
    if (!chatId && phone) {
      const { data: known } = await supabase
        .from("messenger_chats")
        .select("chat_id")
        .eq("provider", "bale")
        .eq("phone", phone)
        .maybeSingle();
      if (known?.chat_id) {
        chatId = known.chat_id;
        hasRegisteredChat = true;
      } else {
        chatId = `98${phone.slice(1)}`;
      }
    }

    if (!chatId) {
      return new Response(JSON.stringify({ error: "شماره تماس یا شناسه گفتگو لازم است" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (!text && (!body.media || body.media.length === 0)) {
      return new Response(JSON.stringify({ error: "متن یا رسانه لازم است" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const call = async (method: string, payload: Record<string, unknown>) => {
      const res = await fetch(`${BALE_API}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let ok = res.ok;
      try {
        const parsed = JSON.parse(raw);
        ok = ok && parsed?.ok !== false;
      } catch {
        ok = false;
      }
      return { ok, raw: raw.slice(0, 500) };
    };

    const log = async (kind: string, value: string | null, result: { ok: boolean; raw: string }) => {
      try {
        await supabase.from("messenger_logs").insert({
          provider: "bale",
          phone: phone || null,
          chat_id: String(chatId),
          kind,
          text: kind === "text" ? value : text || null,
          media_url: kind === "text" ? null : value,
          status: result.ok ? "sent" : "failed",
          provider_response: result.raw,
          order_code: body.orderCode ?? null,
          order_id: body.orderId ?? null,
        });
      } catch (e) {
        console.warn("[send-bale-message] log failed:", e);
      }
    };

    // ارسال با وب‌سرویس سفیر بله بر پایه شماره تماس (بدون نیاز به شروع گفتگو توسط کاربر)
    const safirSend = async (message: string) => {
      if (!safirKey || !safirBotId || !phone) {
        return { ok: false, raw: "کلید سفیر یا شماره تماس موجود نیست" };
      }
      const res = await fetch("https://safir.bale.ai/api/v3/send_message", {
        method: "POST",
        headers: { "api-access-key": safirKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: safirBotId,
          phone_number: `98${phone.replace(/^0/, "")}`,
          message_data: { message: { text: message } },
        }),
      });
      const raw = await res.text();
      return { ok: res.ok, raw: raw.slice(0, 500) };
    };

    const results: Array<{ kind: string; ok: boolean }> = [];
    const mediaAllowed = settings?.send_media !== false;
    const media = mediaAllowed ? (body.media || []).filter((m) => m?.url).slice(0, 10) : [];
    const canUseBot = !!token && hasRegisteredChat;

    let firstCaptionUsed = false;
    if (canUseBot) {
      for (const item of media) {
        const isVideo = item.type === "video" || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(item.url);
        const method = isVideo ? "sendVideo" : "sendPhoto";
        const payload: Record<string, unknown> = { chat_id: chatId };
        payload[isVideo ? "video" : "photo"] = item.url;
        if (text && !firstCaptionUsed) {
          payload.caption = text.slice(0, 1000);
          firstCaptionUsed = true;
        }
        const r = await call(method, payload);
        await log(isVideo ? "video" : "photo", item.url, r);
        results.push({ kind: isVideo ? "video" : "photo", ok: r.ok });
      }

      if (text && !firstCaptionUsed) {
        const r = await call("sendMessage", { chat_id: chatId, text });
        await log("text", text, r);
        results.push({ kind: "text", ok: r.ok });
      }
    }

    // اگر گفتگوی ثبت‌شده نداریم یا ارسال با ربات موفق نبود، از سفیر استفاده می‌کنیم
    if (!results.some((r) => r.ok)) {
      const linkLines = media.map((m) => m.url);
      const message = [text, ...linkLines].filter(Boolean).join("\n");
      const r = await safirSend(message || "پیام جدید از خدمات ساختمانی اهرم — ahrom.ir");
      await log("text", message, r);
      results.push({ kind: "safir", ok: r.ok });
    }

    const success = results.some((r) => r.ok);
    return new Response(JSON.stringify({ success, results, chatId }), {
      status: success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-bale-message] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
