import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BALE_API = "https://tapi.bale.ai";

const normalizeIranPhone = (input: string) => {
  if (!input) return "";
  let raw = String(input).slice(0, 32).replace(/[^0-9+]/g, "");
  if (raw.startsWith("0098")) raw = "0" + raw.slice(4);
  else if (raw.startsWith("098")) raw = "0" + raw.slice(3);
  else if (raw.startsWith("+98")) raw = "0" + raw.slice(3);
  else if (raw.startsWith("98")) raw = "0" + raw.slice(2);
  if (raw.length === 10 && raw.startsWith("9")) raw = "0" + raw;
  return raw;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");

  try {
    const update = await req.json();
    const message = update?.message ?? update?.edited_message;
    const chat = message?.chat;
    if (!chat?.id) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const from = message?.from ?? {};
    const contactPhone = message?.contact?.phone_number
      ? normalizeIranPhone(message.contact.phone_number)
      : null;

    const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ") || null;

    await supabase.from("messenger_chats").upsert(
      {
        provider: "bale",
        chat_id: String(chat.id),
        phone: contactPhone,
        username: from.username ? `@${from.username}` : null,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,chat_id" },
    );

    // پاسخ خوش‌آمد / درخواست شماره تماس برای اتصال حساب
    if (token) {
      const text = contactPhone
        ? "شماره شما ثبت شد ✅ از این پس گزارش مراحل سفارش، عکس و فیلم پیشرفت پروژه را در بله دریافت می‌کنید.\nخدمات ساختمانی و منزل اهرم — ahrom.ir"
        : "به ربات اهرم خوش آمدید 👷\nبرای دریافت گزارش مراحل سفارش، عکس و فیلم پیشرفت پروژه، شماره تماس خود را ارسال کنید.\nahrom.ir";
      await fetch(`${BALE_API}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, text }),
      }).catch(() => undefined);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[bale-webhook] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
