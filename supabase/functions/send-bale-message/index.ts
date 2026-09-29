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

    const safirPhone = phone ? `98${phone.replace(/^0/, "")}` : "";

    // سرور سفیر گاهی اتصال را لحظه‌ای رد می‌کند؛ چند بار با فاصله دوباره تلاش می‌کنیم
    const safirFetch = async (u: string, init: RequestInit) => {
      const delays = [0, 3000, 8000, 15000];
      let lastErr: unknown;
      for (const d of delays) {
        if (d) await new Promise((r) => setTimeout(r, d));
        try {
          const res = await fetch(u, init);
          if (res.status >= 500 || res.status === 429) { lastErr = new Error(`HTTP ${res.status}`); continue; }
          return res;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    };

    // ارسال با وب‌سرویس سفیر بله بر پایه شماره تماس (بدون نیاز به شروع گفتگو توسط کاربر)
    const safirSend = async (message: string, fileId?: string) => {
      if (!safirKey || !safirBotId || !safirPhone) {
        return { ok: false, raw: "کلید سفیر یا شماره تماس موجود نیست" };
      }
      const msg: Record<string, unknown> = {};
      if (message) msg.text = message.slice(0, 3000);
      if (fileId) msg.file_id = fileId;
      const res = await fetch("https://safir.bale.ai/api/v3/send_message", {
        method: "POST",
        headers: { "api-access-key": safirKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: safirBotId,
          phone_number: safirPhone,
          message_data: { message: msg },
        }),
      });
      const raw = await res.text();
      let ok = res.ok;
      try {
        const parsed = JSON.parse(raw);
        const errs = parsed?.error_data;
        if (parsed?.error || (Array.isArray(errs) && errs.length > 0)) ok = false;
      } catch {
        /* پاسخ غیر JSON */
      }
      return { ok, raw: raw.slice(0, 500) };
    };

    // آپلود فایل رسانه در سفیر و گرفتن شناسه فایل برای ارسال خود فایل (نه لینک)
    const MAX_UPLOAD_BYTES = 45 * 1024 * 1024;
    const safirUpload = async (url: string) => {
      if (!safirKey) return { fileId: "", raw: "کلید سفیر موجود نیست", tooBig: false, size: 0 };
      try {
        const fileRes = await fetch(url);
        if (!fileRes.ok) {
          return { fileId: "", raw: `دانلود فایل ناموفق (${fileRes.status})`, tooBig: false, size: 0 };
        }
        const lenHeader = Number(fileRes.headers.get("content-length") || 0);
        if (lenHeader && lenHeader > MAX_UPLOAD_BYTES) {
          return {
            fileId: "",
            raw: `حجم فایل بیش از حد مجاز است (${Math.round(lenHeader / 1048576)}MB)`,
            tooBig: true,
            size: lenHeader,
          };
        }
        const buf = new Uint8Array(await fileRes.arrayBuffer());
        if (buf.byteLength > MAX_UPLOAD_BYTES) {
          return {
            fileId: "",
            raw: `حجم فایل بیش از حد مجاز است (${Math.round(buf.byteLength / 1048576)}MB)`,
            tooBig: true,
            size: buf.byteLength,
          };
        }
        const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
        const name = (url.split("?")[0].split("/").pop() || "file").slice(-80);
        const form = new FormData();
        form.append("file", new Blob([buf], { type: contentType }), name);
        const upRes = await fetch("https://safir.bale.ai/api/v3/upload_file", {
          method: "POST",
          headers: { "api-access-key": safirKey },
          body: form,
        });
        const raw = await upRes.text();
        let fileId = "";
        try {
          const parsed = JSON.parse(raw);
          fileId = parsed?.file_id || parsed?.data?.file_id || parsed?.result?.file_id || "";
        } catch {
          /* پاسخ غیر JSON */
        }
        return { fileId, raw: raw.slice(0, 500), tooBig: false, size: buf.byteLength };
      } catch (e) {
        return {
          fileId: "",
          raw: e instanceof Error ? e.message : String(e),
          tooBig: false,
          size: 0,
        };
      }
    };

    // مسیر فایل در انبار پروژه را از آدرس استخراج می‌کند (برای کاهش حجم خودکار)
    const parseStorage = (url: string) => {
      const m = url.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/([^?]+)/);
      if (!m) return { bucket: "", path: "" };
      return { bucket: m[1], path: decodeURIComponent(m[2]) };
    };

    // نسخه کم‌حجم‌شده آماده را پیدا می‌کند
    const resolveCompressed = async (sourceUrl: string) => {
      const { path } = parseStorage(sourceUrl);
      const q = supabase
        .from("media_compression_jobs")
        .select("output_bucket, output_path")
        .eq("status", "done")
        .not("output_path", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1);
      const { data } = path
        ? await q.eq("source_path", path)
        : await q.eq("source_url", sourceUrl);
      const job = data?.[0];
      if (!job?.output_path) return "";
      const { data: signed } = await supabase.storage
        .from(job.output_bucket || "project-media")
        .createSignedUrl(job.output_path, 60 * 60 * 6);
      return signed?.signedUrl || "";
    };

    // فیلم حجیم را در صف کاهش حجم خودکار می‌گذارد
    const queueCompression = async (sourceUrl: string, size: number) => {
      const { bucket, path } = parseStorage(sourceUrl);
      try {
        const { data: existing } = await supabase
          .from("media_compression_jobs")
          .select("id")
          .in("status", ["pending", "processing"])
          .eq(path ? "source_path" : "source_url", path || sourceUrl)
          .limit(1);
        if (existing && existing.length > 0) return;
        await supabase.from("media_compression_jobs").insert({
          provider: "bale",
          source_url: sourceUrl,
          source_bucket: bucket || null,
          source_path: path || null,
          phone: phone || null,
          chat_id: String(chatId),
          text_body: text || null,
          order_id: body.orderId ?? null,
          order_code: body.orderCode ?? null,
          kind: "video",
          status: "pending",
          source_size: size || null,
        });
      } catch (e) {
        console.warn("[send-bale-message] queue failed:", e);
      }
    };

    const results: Array<{ kind: string; ok: boolean; url?: string }> = [];
    const mediaAllowed = settings?.send_media !== false;
    const media = mediaAllowed ? (body.media || []).filter((m) => m?.url).slice(0, 10) : [];
    const canUseBot = !!token && hasRegisteredChat;
    const isVideoUrl = (m: MediaItem) =>
      m.type === "video" || /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(m.url);

    let textDelivered = false;
    let firstCaptionUsed = false;

    if (canUseBot) {
      for (const item of media) {
        const isVideo = isVideoUrl(item);
        const method = isVideo ? "sendVideo" : "sendPhoto";
        const payload: Record<string, unknown> = { chat_id: chatId };
        payload[isVideo ? "video" : "photo"] = item.url;
        if (text && !firstCaptionUsed) {
          payload.caption = text.slice(0, 1000);
          firstCaptionUsed = true;
        }
        const r = await call(method, payload);
        await log(isVideo ? "video" : "photo", item.url, r);
        results.push({ kind: isVideo ? "video" : "photo", ok: r.ok, url: item.url });
        if (r.ok && firstCaptionUsed) textDelivered = true;
      }

      if (text && !textDelivered) {
        const r = await call("sendMessage", { chat_id: chatId, text });
        await log("text", text, r);
        results.push({ kind: "text", ok: r.ok });
        if (r.ok) textDelivered = true;
      }
    }

    // ارسال با سفیر: خود عکس و فیلم به‌صورت فایل برای شماره موبایل ارسال می‌شود
    const botMediaFailed = media.filter(
      (m) => !results.some((r) => r.ok && r.url === m.url),
    );

    if (safirKey && safirBotId && safirPhone) {
      for (const item of botMediaFailed) {
        const kind = isVideoUrl(item) ? "video" : "photo";
        let up = await safirUpload(item.url);

        // فیلم حجیم: اول نسخه کم‌حجم‌شده، در غیر این‌صورت صف کاهش خودکار حجم
        if (!up.fileId && up.tooBig && kind === "video") {
          const alt = await resolveCompressed(item.url);
          if (alt) up = await safirUpload(alt);
          if (!up.fileId) {
            await queueCompression(item.url, up.size);
            const r = {
              ok: false,
              raw: `حجم فیلم زیاد است؛ کاهش خودکار کیفیت و کوتاه‌کردن انتهای فیلم در صف قرار گرفت (${up.raw})`,
            };
            await log(kind, item.url, r);
            results.push({ kind, ok: false, url: item.url });
            continue;
          }
        }

        if (!up.fileId) {
          const r = { ok: false, raw: `آپلود در بله ناموفق: ${up.raw}` };
          await log(kind, item.url, r);
          results.push({ kind, ok: false, url: item.url });
          continue;
        }
        const caption = !textDelivered ? text : "";
        const r = await safirSend(caption, up.fileId);
        if (r.ok && caption) textDelivered = true;
        await log(kind, item.url, r);
        results.push({ kind, ok: r.ok, url: item.url });
      }

      if (text && !textDelivered) {
        const r = await safirSend(text);
        await log("text", text, r);
        results.push({ kind: "text", ok: r.ok });
        if (r.ok) textDelivered = true;
      }
    }

    if (results.length === 0) {
      const r = await safirSend(text || "پیام جدید از خدمات ساختمانی اهرم — ahrom.ir");
      await log("text", text, r);
      results.push({ kind: "text", ok: r.ok });
    }

    const success = results.some((r) => r.ok);
    const mediaResults = results.filter((r) => r.kind === "photo" || r.kind === "video");
    return new Response(
      JSON.stringify({
        success,
        results,
        chatId,
        mediaSent: mediaResults.filter((r) => r.ok).length,
        mediaFailed: mediaResults.filter((r) => !r.ok).length,
      }),
      {
        status: success ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );


  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-bale-message] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
