import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const toJalali = (d: string | null) => {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" })
      .format(new Date(d.length <= 10 ? `${d}T12:00:00Z` : d));
  } catch { return d; }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let claimedId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;
  // اگر ارسال انجام نشد، علامت «ارسال‌شده» برداشته می‌شود تا فایل گم نشود
  const releaseClaim = async () => {
    if (!claimedId || !supabase) return;
    const id = claimedId;
    claimedId = null;
    await supabase.from("project_media").update({ bale_sent_at: null }).eq("id", id);
  };
  try {
    const { media_id } = await req.json().catch(() => ({}));
    if (typeof media_id !== "string" || !/^[0-9a-f-]{36}$/i.test(media_id)) return json({ error: "invalid media_id" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(url, key);

    // کمی صبر تا تاریخ و توضیحات فایل هم ثبت شود
    await new Promise((r) => setTimeout(r, 15000));

    // پیش از قفل‌کردن بررسی می‌شود تا فایل به اشتباه «ارسال‌شده» علامت نخورد
    const { data: settings } = await supabase
      .from("messenger_settings").select("enabled, send_media").eq("provider", "bale").maybeSingle();
    if (!settings?.enabled || settings?.send_media === false) return json({ skipped: "disabled" });

    const { data: mediaRow } = await supabase
      .from("project_media").select("project_id, bale_sent_at").eq("id", media_id).maybeSingle();
    if (!mediaRow) return json({ skipped: "not found" });
    if (mediaRow.bale_sent_at) return json({ skipped: "already sent" });

    const { data: order } = await supabase
      .from("projects_v3").select("code, customer_phone, address, detailed_address").eq("id", mediaRow.project_id).maybeSingle();
    if (!order?.customer_phone) return json({ skipped: "no phone" });

    // قفل: فقط یک بار ارسال
    const { data: claimed } = await supabase
      .from("project_media")
      .update({ bale_sent_at: new Date().toISOString() })
      .eq("id", media_id)
      .is("bale_sent_at", null)
      .select("id, project_id, file_path, file_type, file_size, content_hash, duration_seconds, media_date, description, created_at")
      .maybeSingle();
    if (!claimed) return json({ skipped: "already sent" });
    claimedId = claimed.id;

    // فایل تکراری همین سفارش که قبلاً فرستاده شده
    const { data: others } = await supabase
      .from("project_media")
      .select("id, content_hash, file_type, duration_seconds, file_size, media_date")
      .eq("project_id", claimed.project_id).neq("id", claimed.id).not("bale_sent_at", "is", null);
    const dup = (others || []).some((o: any) =>
      (claimed.content_hash && o.content_hash === claimed.content_hash) ||
      (String(claimed.file_type).startsWith("video") && claimed.duration_seconds && o.duration_seconds &&
        Math.abs(Number(o.duration_seconds) - Number(claimed.duration_seconds)) <= 0.5 &&
        String(o.media_date) === String(claimed.media_date) &&
        (!claimed.file_size || !o.file_size ||
          Math.abs(o.file_size - claimed.file_size) / Math.max(o.file_size, claimed.file_size) <= 0.03)));
    if (dup) { claimedId = null; return json({ skipped: "duplicate" }); }

    // آخرین توضیحات ثبت‌شده را دوباره بخوان
    const { data: fresh } = await supabase
      .from("project_media").select("description, media_date").eq("id", claimed.id).maybeSingle();
    const description = (fresh?.description ?? claimed.description ?? "").toString().trim();
    const address = [order.address, order.detailed_address]
      .map((s: any) => (s || "").toString().trim()).filter(Boolean)
      .filter((s: string, i: number, a: string[]) => a.indexOf(s) === i).join(" - ");

    const isVideo = String(claimed.file_type || "").startsWith("video");
    const { data: pub } = supabase.storage.from("project-media").getPublicUrl(claimed.file_path);
    const lines = [
      "خدمات ساختمانی و منزل اهرم",
      `${isVideo ? "فیلم" : "عکس"} جدید سفارش ${order.code || ""}`,
      `تاریخ: ${toJalali(fresh?.media_date || claimed.media_date || claimed.created_at)}`,
    ];
    if (address) lines.push(`آدرس: ${address}`);
    if (description) lines.push(`توضیحات: ${description}`);
    lines.push("ahrom.ir");

    const payload = JSON.stringify({
      phone: order.customer_phone,
      text: lines.join("\n"),
      media: [{ url: pub.publicUrl, type: isVideo ? "video" : "photo" }],
      orderCode: order.code,
      orderId: claimed.project_id,
    });

    // تا سه بار تلاش؛ فقط وقتی خود فایل تحویل شد «ارسال‌شده» می‌ماند
    let delivered = false;
    let lastStatus = 0;
    for (let attempt = 1; attempt <= 3 && !delivered; attempt++) {
      try {
        const r = await fetch(`${url}/functions/v1/send-bale-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: payload,
        });
        lastStatus = r.status;
        const body = await r.json().catch(() => ({} as any));
        // فیلم حجیمی که برای کاهش حجم در صف رفته، بعداً خودکار ارسال می‌شود و تحویل‌شده حساب می‌شود
        const failed = Number(body?.mediaFailed) || 0;
        const queued = Number(body?.mediaQueued) || 0;
        delivered = (r.ok || queued > 0) && failed - queued <= 0;
      } catch (_) {
        delivered = false;
      }
      if (!delivered && attempt < 3) await new Promise((res) => setTimeout(res, attempt * 5000));
    }

    if (!delivered) {
      await releaseClaim();
      return json({ sent: false, status: lastStatus }, 502);
    }
    claimedId = null;
    return json({ sent: true });
  } catch (e) {
    await releaseClaim();
    return json({ error: String(e) }, 500);
  }
});
