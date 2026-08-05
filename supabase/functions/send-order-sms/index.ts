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

// تابع برای تبدیل تاریخ میلادی به شمسی
function toJalali(date: Date): string {
  const gyear = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gyear <= 1600 ? 0 : 979;
  if (gyear <= 1600) {
    jy = 0;
  } else {
    jy = 979 + 33;
  }
  
  const gy2 = gyear <= 1600 ? gyear - 621 : gyear - 1600;
  let days = (365 * gy2) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  
  if (gm > 2) {
    days += ((gyear % 4 === 0 && gyear % 100 !== 0) || gyear % 400 === 0) ? 1 : 0;
  }
  
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  
  let jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  
  return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;
}

function formatPersianDateTime(): string {
  const now = new Date();
  const jalaliDate = toJalali(now);
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${jalaliDate} ساعت ${hours}:${minutes}`;
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
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, orderCode, orderId, status, serviceType, address, dateTime, amount, customerName }: SmsRequest = await req.json();
    
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


    // Get SMS template — prefer DB-managed template, fallback to in-code default
    let template = SMS_TEMPLATES[status];
    let dbTpl: any = null;
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


    // تاریخ و زمان شمسی
    const persianDateTime = dateTime || formatPersianDateTime();
    
    // لینک سفارش
    const orderLink = orderId ? `https://ahrom.ir/orders/${orderId}` : "https://ahrom.ir/my-orders";
    
    // فرمت مبلغ
    const formattedAmount = amount ? amount.toLocaleString('fa-IR') : "تعیین نشده";
    
    // برچسب مرحله سفارش را داخل نام خدمت می‌گنجانیم تا قالب تایید شده پارس‌گرین حفظ شود
    const stageLabel = STAGE_LABELS[status];
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
      .replaceAll("{customerName}", customerName || "مشتری");


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
    return new Response(
      JSON.stringify({ success: false, error: "خطا در ارسال پیامک", details: responseText.slice(0, 300) }),
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
