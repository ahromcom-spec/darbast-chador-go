import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Phone numbers to exclude from SMS
const EXCLUDED_PHONES = [
  "09000000000",
  "09012121212",
  "09013131313",
];

// Normalize to Iranian mobile format: 09XXXXXXXXX
const normalizeIranPhone = (input: string) => {
  if (!input) return "";
  if (input.length > 32) return "";
  const limited = input.slice(0, 32);

  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const toAscii = (s: string) =>
    s
      .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));

  let raw = toAscii(limited).replace(/[^0-9+]/g, "");
  if (raw.startsWith("0098")) raw = "0" + raw.slice(4);
  else if (raw.startsWith("098")) raw = "0" + raw.slice(3);
  else if (raw.startsWith("98")) raw = "0" + raw.slice(2);
  else if (raw.startsWith("+98")) raw = "0" + raw.slice(3);
  if (raw.length === 10 && raw.startsWith("9")) raw = "0" + raw;
  return raw;
};

// تاریخ و ساعت شمسی به وقت ایران (Asia/Tehran)
const IRAN_TZ = "Asia/Tehran";

const toEnDigits = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
   .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

function toJalali(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: IRAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => toEnDigits(parts.find((p) => p.type === t)?.value || "");
  const year = get("year").replace(/[^0-9]/g, "");
  return `${year}/${get("month")}/${get("day")}`;
}

function formatIranClock(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IRAN_TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => toEnDigits(parts.find((p) => p.type === t)?.value || "00");
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${hour.padStart(2, "0")}:${get("minute").padStart(2, "0")}`;
}

function formatPersianDateTime(): string {
  const now = new Date();
  return `${toJalali(now)} ساعت ${formatIranClock(now)}`;
}

// برچسب وضعیت سفارش که داخل serviceType جای داده می‌شود (الگوی پیامک توسط پارس‌گرین تایید شده و نباید تغییر کند)
const STAGE_LABELS: Record<string, string> = {
  submitted: "ثبت شد",
  approved: "تایید شد",
  in_progress: "در حال اجرا",
  executed: "اجرا شد",
  awaiting_payment: "در انتظار پرداخت",
  paid: "پرداخت شد",
  awaiting_collection: "در انتظار جمع‌آوری",
  in_collection: "در حال جمع‌آوری",
  collected: "جمع‌آوری شد",
  completed: "به اتمام رسید",
  rental_started: "شروع کرایه",
  contractor_pending_request: "در انتظار پذیرش شما",
};

// قالب تایید شده توسط پارس‌گرین برای شماره 90000319
const APPROVED_TEMPLATE = "📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ: {dateTime}";
// قالب همراه با مبلغ سفارش (ثبت و تایید سفارش)
const APPROVED_TEMPLATE_WITH_AMOUNT = "📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - مبلغ: {amount} تومان - تاریخ: {dateTime}";

// SMS templates for each order status with placeholders
const SMS_TEMPLATES: Record<string, string> = {
  submitted: APPROVED_TEMPLATE_WITH_AMOUNT,
  approved: APPROVED_TEMPLATE_WITH_AMOUNT,
  in_progress: APPROVED_TEMPLATE,
  executed: APPROVED_TEMPLATE,
  awaiting_payment: APPROVED_TEMPLATE,
  paid: APPROVED_TEMPLATE,
  awaiting_collection: APPROVED_TEMPLATE,
  in_collection: APPROVED_TEMPLATE,
  contractor_pending_request: APPROVED_TEMPLATE,
  collected: APPROVED_TEMPLATE,
  completed: APPROVED_TEMPLATE,
  rental_started: "📋 سفارش جدید: کد {code} - {serviceType} - آدرس: {address} - مشتری: {customerName} - تاریخ شروع کرایه: {rentalStartDate} - تاریخ: {dateTime}",
  // پیامک‌های مخصوص مدیرعامل
  ceo_new_order: APPROVED_TEMPLATE,
  ceo_payment: APPROVED_TEMPLATE,
};


interface SmsRequest {
  phone: string;
  orderCode: string;
  orderId?: string;
  status: string;
  serviceType?: string;
  address?: string;
  dateTime?: string;
  amount?: number;
  customerName?: string; // نام مشتری برای پیامک مدیرعامل
  description?: string; // شرح فعالیت سفارش
  resendMessage?: string; // ارسال مجدد متن پیامک قبلی (بدون قالب) با تاریخ جدید
  bypassWindow?: boolean; // نادیده گرفتن بازه زمانی (برای ارسال‌های زمان‌بندی‌شده)
  paidAmount?: number; // مبلغ همین پرداخت
  totalPaid?: number; // مجموع پرداخت‌شده تا کنون
  remainingAmount?: number; // مانده سفارش
  retryCount?: number; // شمارش تلاش‌های خودکار مجدد در صورت ناموفق بودن
}

// حداکثر تلاش خودکار مجدد در صورت ناموفق بودن ارسال
const MAX_AUTO_RETRIES = 5;
// بازه رندوم تلاش مجدد: از ۵ تا ۱۲۰ ثانیه (برای جلوگیری از تجمع ارسال‌ها)
const randomRetryDelayMs = () => (5 + Math.floor(Math.random() * 116)) * 1000;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, orderCode, orderId, status, serviceType, address, dateTime, amount, customerName, description, resendMessage, bypassWindow, retryCount, paidAmount, totalPaid, remainingAmount }: SmsRequest = await req.json();
    const isResend = typeof resendMessage === "string" && resendMessage.trim().length > 0;
    const attemptNo = Number(retryCount ?? 0);

    
    console.log(`[send-order-sms] Received request - Phone: ${phone}, Order: ${orderCode}, Status: ${status}, Service: ${serviceType}, Address: ${address}, Amount: ${amount}, Customer: ${customerName}`);

    // Validate inputs
    if (!phone || !orderCode || !status) {
      console.error("[send-order-sms] Missing required fields");
      return new Response(
        JSON.stringify({ error: "شماره تلفن، کد سفارش و وضعیت الزامی است" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedPhone = normalizeIranPhone(phone);

    if (!/^09[0-9]{9}$/.test(normalizedPhone)) {
      console.error(`[send-order-sms] Invalid phone format: ${phone}`);
      return new Response(
        JSON.stringify({ error: "شماره تلفن نامعتبر است" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if phone is in excluded list
    if (EXCLUDED_PHONES.includes(normalizedPhone)) {
      console.log(`[send-order-sms] Phone ${normalizedPhone} is in excluded list, skipping SMS`);
      return new Response(
        JSON.stringify({ success: true, message: "شماره در لیست استثنا است، پیامی ارسال نشد" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if phone is in staff whitelist (managers/staff)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // پیامک‌های مدیرعامل باید بدون توجه به whitelist ارسال شوند
    const isCeoNotification = status === "ceo_new_order" || status === "ceo_payment";
    const isContractorNotification = status === "contractor_pending_request";

    if (!isCeoNotification && !isContractorNotification) {
      // Check phone_whitelist table
      const { data: whitelistData } = await supabase
        .from("phone_whitelist")
        .select("id")
        .eq("phone_number", normalizedPhone)
        .maybeSingle();

      if (whitelistData) {
        console.log(`[send-order-sms] Phone ${normalizedPhone} is in phone_whitelist (staff), skipping SMS`);
        return new Response(
          JSON.stringify({ success: true, message: "شماره متعلق به پرسنل است، پیامی ارسال نشد" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check staff_whitelist table
      const { data: staffWhitelistData } = await supabase
        .from("staff_whitelist")
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (staffWhitelistData) {
        console.log(`[send-order-sms] Phone ${normalizedPhone} is in staff_whitelist, skipping SMS`);
        return new Response(
          JSON.stringify({ success: true, message: "شماره متعلق به پرسنل است، پیامی ارسال نشد" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      console.log(`[send-order-sms] CEO notification (${status}) — bypassing whitelist filter`);
    }

    // === بازه زمانی مجاز ارسال پیامک به مشتری (به وقت تهران) ===
    // پیامک مدیرعامل و ارسال‌های زمان‌بندی‌شده از این محدودیت مستثنا هستند
    if (!isCeoNotification && !bypassWindow) {
      try {
        const { data: winRow } = await supabase
          .from("sms_send_window")
          .select("enabled, start_time, end_time")
          .maybeSingle();

        const validTime = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

        if (winRow?.enabled && validTime(winRow.start_time) && validTime(winRow.end_time)) {
          const toMin = (hhmm: string) => {
            const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
            return h * 60 + m;
          };
          const startMin = toMin(winRow.start_time as string);
          const endMin = toMin(winRow.end_time as string);

          // ساعت جاری تهران
          const tehranParts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Tehran",
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          }).formatToParts(new Date());
          const hh = Number(tehranParts.find((p) => p.type === "hour")?.value) % 24;
          const mm = Number(tehranParts.find((p) => p.type === "minute")?.value);
          const cur = hh * 60 + mm;

          const inside =
            startMin === endMin
              ? true
              : startMin < endMin
              ? cur >= startMin && cur < endMin
              : cur >= startMin || cur < endMin;

          if (!inside) {
            const waitMinutes = cur < startMin ? startMin - cur : 1440 - cur + startMin;
            const sendAfter = new Date(Date.now() + waitMinutes * 60_000).toISOString();

            // اگر همین پیامک از قبل در صف است، رکورد تکراری ساخته نشود
            const { data: alreadyQueued } = await supabase
              .from("scheduled_sms")
              .select("id")
              .eq("phone", normalizedPhone)
              .eq("order_code", orderCode)
              .eq("status_key", status)
              .in("state", ["pending", "sending"])
              .limit(1)
              .maybeSingle();

            if (alreadyQueued) {
              console.log("[send-order-sms] Duplicate queue request ignored");
              return new Response(
                JSON.stringify({ success: true, scheduled: true, message: "این پیامک قبلاً در صف ارسال است" }),
                { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
              );
            }

            const { error: queueError } = await supabase.from("scheduled_sms").insert({
              phone: normalizedPhone,
              order_code: orderCode,
              order_id: orderId ?? null,
              status_key: status,
              payload: { serviceType, address, amount, customerName, description, resendMessage, paidAmount, totalPaid, remainingAmount },
              send_after: sendAfter,
            });


            if (!queueError) {
              console.log(`[send-order-sms] Outside allowed window — queued for ${sendAfter}`);
              return new Response(
                JSON.stringify({
                  success: true,
                  scheduled: true,
                  scheduledFor: sendAfter,
                  message: "پیامک در بازه مجاز ارسال خواهد شد",
                }),
                { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
              );
            }
            console.warn("[send-order-sms] Failed to queue SMS, sending now:", queueError);
          }
        }
      } catch (e) {
        console.warn("[send-order-sms] Send-window check failed, sending now:", e);
      }
    }



    // Get SMS template — prefer DB-managed template, fallback to in-code default
    let template = SMS_TEMPLATES[status];
    let dbTpl: any = null;
    if (isResend) {
      // ارسال مجدد: همان متن قبلی، فقط تاریخ به تاریخ جدید به‌روزرسانی می‌شود
      template = resendMessage!;
    } else {
    try {
      const { data: tplRow } = await supabase
        .from("sms_templates")
        .select("template, enabled, delay_minutes, conditions, footer, append_footer, scope")
        .eq("key", status)
        .maybeSingle();
      if (tplRow) {
        dbTpl = tplRow;
        if (tplRow.enabled === false) {
          console.log(`[send-order-sms] Template ${status} disabled by admin, skipping SMS`);
          await supabase.from("sms_logs").insert({
            template_key: status, scope: tplRow.scope, recipient: normalizedPhone,
            message: "", status: "skipped", provider_response: "disabled by admin",
            order_code: orderCode, order_id: orderId ?? null,
          });
          return new Response(
            JSON.stringify({ success: true, message: "ارسال این پیامک توسط مدیریت غیرفعال است" }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        if (tplRow.template && tplRow.template.trim().length > 0) {
          template = tplRow.template;
        }
      }
    } catch (e) {
      console.warn("[send-order-sms] Failed to load template from DB, using default:", e);
    }

    if (!template) {
      console.error(`[send-order-sms] Unknown status: ${status}`);
      return new Response(
        JSON.stringify({ error: `وضعیت نامعتبر: ${status}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Conditional amount gating
    try {
      const cond = (dbTpl?.conditions ?? {}) as Record<string, any>;
      const skipFor = (reason: string) => supabase.from("sms_logs").insert({
        template_key: status, scope: dbTpl?.scope, recipient: normalizedPhone,
        message: "", status: "skipped", provider_response: reason,
        order_code: orderCode, order_id: orderId ?? null,
      });
      if (typeof cond.minAmount === "number" && (amount ?? 0) < cond.minAmount) {
        await skipFor(`below minAmount ${cond.minAmount}`);
        return new Response(JSON.stringify({ success: true, message: "شرط حداقل مبلغ برقرار نیست" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      if (typeof cond.maxAmount === "number" && (amount ?? 0) > cond.maxAmount) {
        await skipFor(`above maxAmount ${cond.maxAmount}`);
        return new Response(JSON.stringify({ success: true, message: "شرط حداکثر مبلغ برقرار نیست" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    } catch (_) { /* ignore */ }
    }




    // تاریخ و زمان شمسی
    const persianDateTime = dateTime || formatPersianDateTime();
    
    // لینک سفارش
    const orderLink = orderId ? `https://ahrom.ir/orders/${orderId}` : "https://ahrom.ir/my-orders";
    // لینک پرداخت سفارش (کاربر مستقیم به بخش پرداخت سفارش هدایت می‌شود)
    const paymentLink = orderId ? `https://ahrom.ir/user/orders/${orderId}?pay=1` : "https://ahrom.ir/user/orders";

    
    // فرمت مبلغ
    const formattedAmount = amount ? amount.toLocaleString('fa-IR') : "تعیین نشده";
    
    // === متغیرهای تاریخ و مبالغ پرداخت از روی سفارش ===
    const fmtDate = (v?: string | null) => {
      if (!v) return "ثبت نشده";
      const d = new Date(v);
      return isNaN(d.getTime()) ? "ثبت نشده" : toJalali(d);
    };
    const fmtMoney = (n?: number | null) =>
      typeof n === "number" && Number.isFinite(n) ? `${Math.max(0, n).toLocaleString("fa-IR")} تومان` : "ثبت نشده";
    let rentalStartDate = "ثبت نشده", collectionDate = "ثبت نشده", completionDate = "ثبت نشده", paymentDate = "ثبت نشده";
    let resolvedTotalPaid = totalPaid, resolvedRemaining = remainingAmount, resolvedPaidAmount = paidAmount;
    if (orderId) {
      try {
        const [{ data: ord }, { data: col }, { data: pay }] = await Promise.all([
          supabase.from("projects_v3").select("rental_start_date, executive_completion_date, customer_completion_date, closed_at, total_price, total_paid").eq("id", orderId).maybeSingle(),
          supabase.from("collection_requests").select("requested_date, confirmed_date").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("order_payments").select("amount, payment_date, created_at").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        rentalStartDate = fmtDate((ord as any)?.rental_start_date);
        collectionDate = fmtDate((col as any)?.confirmed_date || (col as any)?.requested_date);
        completionDate = fmtDate((ord as any)?.executive_completion_date || (ord as any)?.customer_completion_date || (ord as any)?.closed_at);
        paymentDate = fmtDate((pay as any)?.payment_date || (pay as any)?.created_at);
        if (resolvedPaidAmount === undefined && (pay as any)?.amount != null) resolvedPaidAmount = Number((pay as any).amount);
        if (resolvedTotalPaid === undefined && (ord as any)?.total_paid != null) resolvedTotalPaid = Number((ord as any).total_paid);
        if (resolvedRemaining === undefined && (ord as any)?.total_price != null && resolvedTotalPaid !== undefined) {
          resolvedRemaining = Number((ord as any).total_price) - resolvedTotalPaid;
        }
      } catch (e) {
        console.warn("[send-order-sms] Could not resolve date/payment variables:", e);
      }
    }
    if (status === "paid" && paymentDate === "ثبت نشده") paymentDate = toJalali(new Date());

    // برچسب مرحله سفارش را داخل نام خدمت می‌گنجانیم تا قالب تایید شده پارس‌گرین حفظ شود
    let stageLabel = STAGE_LABELS[status];
    if ((status === "paid" || status === "ceo_payment") && typeof resolvedRemaining === "number" && resolvedRemaining > 0) {
      stageLabel = "پرداخت بخشی از مبلغ";
    }
    const baseService = serviceType || "خدمات";
    const decoratedService = stageLabel ? `${baseService} (${stageLabel})` : baseService;

    // حذف بخش‌های تکراری آدرس (مثلاً وقتی آدرس و آدرس دقیق یکی هستند)
    const dedupeAddress = (input?: string) => {
      const raw = (input || "").trim();
      if (!raw) return "ثبت نشده";
      const parts = raw.split(" - ").map((p) => p.trim()).filter(Boolean);
      const norm = (s: string) => s.replace(/[\s،,.\-]+/g, "");
      const kept: string[] = [];
      for (const p of parts) {
        const np = norm(p);
        if (kept.some((k) => norm(k) === np || norm(k).includes(np))) continue;
        // اگر بخش جدید شامل بخش قبلی است، بخش قبلی حذف شود
        for (let i = kept.length - 1; i >= 0; i--) {
          if (np.includes(norm(kept[i]))) kept.splice(i, 1);
        }
        kept.push(p);
      }
      return kept.join(" - ") || raw;
    };

    // Replace placeholders in template
    let message = template
      .replaceAll("{code}", orderCode)
      .replaceAll("{serviceType}", decoratedService)
      .replaceAll("{address}", dedupeAddress(address))
      .replaceAll("{dateTime}", persianDateTime)
      .replaceAll("{amount}", formattedAmount)
      .replaceAll("{orderLink}", orderLink)
      .replaceAll("{paymentLink}", paymentLink)
      .replaceAll("{customerName}", customerName || "مشتری")
      .replaceAll("{rentalStartDate}", rentalStartDate)
      .replaceAll("{collectionDate}", collectionDate)
      .replaceAll("{completionDate}", completionDate)
      .replaceAll("{paymentDate}", paymentDate)
      .replaceAll("{paidAmount}", fmtMoney(resolvedPaidAmount))
      .replaceAll("{totalPaid}", fmtMoney(resolvedTotalPaid))
      .replaceAll("{remainingAmount}", fmtMoney(resolvedRemaining))
      .replaceAll("{description}", (description || "").toString().trim() || "ثبت نشده");

    // ارسال مجدد: تاریخ و ساعت داخل متن با تاریخ جدید جایگزین شود
    if (isResend) {
      const dateLine = /تاریخ:\s*[^\n]*/;
      if (dateLine.test(message)) {
        message = message.replace(dateLine, `تاریخ: ${persianDateTime}`);
      } else {
        message = `${message}\nتاریخ: ${persianDateTime}`;
      }
    }



    // === سربرگ اجباری برند: همیشه در خط اول پیامک ===
    const BRAND_HEADER = "خدمات ساختمانی و منزل اهرم";
    if (!message.startsWith(BRAND_HEADER)) {
      message = `${BRAND_HEADER}\n${message}`;
    }

    // === پابرگ اجباری برند: همیشه باید "ahrom.ir" در انتهای پیامک باشد ===
    const footerText = (dbTpl?.footer ?? "ahrom.ir").toString().trim() || "ahrom.ir";
    const shouldAppend = dbTpl?.append_footer !== false;
    if (shouldAppend && !message.includes(footerText)) {
      message = `${message}\n${footerText}`;
    }
    // تضمین وجود برند ahrom.ir در همه پیامک‌ها
    if (!message.includes("ahrom.ir")) {
      message = `${message}\nahrom.ir`;
    }

    // === تأخیر زمانی ===
    const delayMinutes = Number(dbTpl?.delay_minutes ?? 0);
    if (delayMinutes > 0 && delayMinutes <= 5) {
      await new Promise((r) => setTimeout(r, delayMinutes * 60_000));
    } else if (delayMinutes > 5) {
      console.log(`[send-order-sms] Delay ${delayMinutes}m exceeds inline limit; sending immediately`);
    }

    console.log(`[send-order-sms] Sending message: ${message}`);

    // === ارسال همزمان در پیامرسان بله (در صورت فعال بودن) ===
    try {
      const { data: messenger } = await supabase
        .from("messenger_settings")
        .select("enabled, send_media, notify_ceo")
        .eq("provider", "bale")
        .maybeSingle();

      const baleAllowed =
        messenger?.enabled === true && (!isCeoNotification || messenger?.notify_ceo !== false);

      if (baleAllowed) {
        // عکس و فیلم فقط هنگام افزوده شدن به سفارش (bale-order-media) ارسال می‌شود، نه با تغییر مرحله
        const media: Array<{ url: string; type: "photo" | "video" }> = [];
        let alreadySent = false;
        if (orderId) {
          const { data: prev } = await supabase
            .from("messenger_logs")
            .select("id")
            .eq("provider", "bale")
            .eq("order_id", orderId)
            .eq("kind", "text")
            .eq("status", "sent")
            .eq("text", message)
            .limit(1);
          alreadySent = (prev?.length ?? 0) > 0;
        }
        if (!alreadySent)
        await fetch(`${supabaseUrl}/functions/v1/send-bale-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            phone: normalizedPhone,
            text: message,
            media,
            orderCode,
            orderId: orderId ?? undefined,
          }),
        });
      }
    } catch (e) {
      console.warn("[send-order-sms] Bale send failed:", e);
    }




    // Get ParsGreen credentials
    const apiKey = Deno.env.get("PARSGREEN_API_KEY");
    const rawSender = Deno.env.get("PARSGREEN_SENDER") || "";

    if (!apiKey) {
      console.error("[send-order-sms] PARSGREEN_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "تنظیمات پنل پیامکی انجام نشده است" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const senderNumber = /^[0-9]+$/.test(rawSender) ? rawSender : "90000319";
    if (rawSender && !/^[0-9]+$/.test(rawSender)) {
      console.warn("[send-order-sms] PARSGREEN_SENDER is not numeric; falling back to 90000319");
    }

    // Send SMS via ParsGreen URLService (same endpoint as OTP)
    const apiUrl = "https://sms.parsgreen.ir/UrlService/sendSMS.ashx";
    const params = new URLSearchParams({
      from: senderNumber,
      to: normalizedPhone,
      text: message,
      signature: apiKey,
    });

    // === جلوگیری از ارسال پیام تکراری: اگر همین متن در ۳۰ دقیقه گذشته با موفقیت رفته، ارسال نشود ===
    try {
      const since = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data: recentSent } = await supabase
        .from("sms_logs")
        .select("id")
        .eq("recipient", normalizedPhone)
        .eq("message", message)
        .eq("status", "sent")
        .gte("created_at", since)
        .limit(1)
        .maybeSingle();

      if (recentSent) {
        console.log("[send-order-sms] Duplicate message detected, skipping send");
        await supabase.from("sms_logs").insert({
          template_key: status,
          scope: dbTpl?.scope,
          recipient: normalizedPhone,
          message: "",
          status: "skipped",
          provider_response: "duplicate within 30m",
          order_code: orderCode,
          order_id: orderId ?? null,
        });
        return new Response(
          JSON.stringify({ success: true, duplicate: true, message: "این پیامک قبلاً ارسال شده است" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } catch (e) {
      console.warn("[send-order-sms] Duplicate check failed:", e);
    }

    console.log(`[send-order-sms] Calling ParsGreen URLService for phone: ${normalizedPhone}`);


    const smsResponse = await fetch(`${apiUrl}?${params.toString()}`, { method: "GET" });
    const responseText = (await smsResponse.text()).trim();

    const parts = responseText.split(";");
    const pureNumeric = /^[0-9]+$/.test(responseText);
    const hasSemicolonNumeric = parts.length === 3 && parts.every((p) => /^[0-9]+$/.test(p));

    const lower = responseText.toLowerCase();
    const looksError =
      lower.includes("error") ||
      lower.includes("request not valid") ||
      lower.includes("filteration") ||
      responseText.includes("خطا") ||
      responseText.includes("<html") ||
      responseText.includes("<!DOCTYPE");

    const isSuccess = smsResponse.ok && (pureNumeric || hasSemicolonNumeric) && !looksError;

    console.log(
      `[send-order-sms] ParsGreen response (status ${smsResponse.status}): ${responseText.slice(0, 300)}`
    );

    // Audit log
    try {
      await supabase.from("sms_logs").insert({
        template_key: status,
        scope: dbTpl?.scope,
        recipient: normalizedPhone,
        message,
        status: isSuccess ? "sent" : "failed",
        provider_response: responseText.slice(0, 500),
        order_code: orderCode,
        order_id: orderId ?? null,
      });
    } catch (e) {
      console.warn("[send-order-sms] Failed to write sms_logs:", e);
    }

    if (isSuccess) {
      console.log(`[send-order-sms] SMS sent successfully to ${normalizedPhone}`);
      return new Response(
        JSON.stringify({ success: true, message: "پیامک با موفقیت ارسال شد" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.error(`[send-order-sms] Failed to send SMS: ${responseText.slice(0, 300)}`);

    // === تلاش خودکار مجدد با زمان رندوم (۵ تا ۱۲۰ ثانیه) ===
    let retryAt: string | null = null;
    if (attemptNo < MAX_AUTO_RETRIES) {
      try {
        const sendAfter = new Date(Date.now() + randomRetryDelayMs()).toISOString();

        // اگر برای همین سفارش و همین مرحله تلاش مجددی در صف است، رکورد جدید ساخته نشود
        const { data: pendingRetry } = await supabase
          .from("scheduled_sms")
          .select("id")
          .eq("phone", normalizedPhone)
          .eq("order_code", orderCode)
          .eq("status_key", status)
          .eq("state", "pending")
          .limit(1)
          .maybeSingle();

        if (pendingRetry) {
          console.log("[send-order-sms] Retry already queued, skipping duplicate retry");
          return new Response(
            JSON.stringify({ success: false, error: "خطا در ارسال پیامک", retryAlreadyQueued: true }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const { error: retryError } = await supabase.from("scheduled_sms").insert({
          phone: normalizedPhone,
          order_code: orderCode,

          order_id: orderId ?? null,
          status_key: status,
          payload: {
            serviceType,
            address,
            amount,
            customerName,
            description,
            // متن نهایی حفظ می‌شود تا پیام مجدد دقیقاً همان پیام باشد
            resendMessage: message,
            retryCount: attemptNo + 1,
          },
          send_after: sendAfter,
          last_error: `retry ${attemptNo + 1}/${MAX_AUTO_RETRIES}: ${responseText.slice(0, 200)}`,
        });
        if (retryError) {
          console.warn("[send-order-sms] Could not queue retry:", retryError);
        } else {
          retryAt = sendAfter;
          console.log(`[send-order-sms] Retry #${attemptNo + 1} queued for ${sendAfter}`);
        }
      } catch (e) {
        console.warn("[send-order-sms] Retry scheduling failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "خطا در ارسال پیامک",
        details: responseText.slice(0, 300),
        retryScheduledFor: retryAt,
        retryCount: retryAt ? attemptNo + 1 : attemptNo,
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );


  } catch (error: any) {
    console.error("[send-order-sms] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
