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

// SMS templates for each order status with placeholders
const SMS_TEMPLATES: Record<string, string> = {
  submitted: "سفارش {serviceType} با کد {code} در تاریخ {dateTime} در آدرس {address} در اهرم ثبت شد و در انتظار تایید است. مشاهده سفارش: {orderLink}",
  approved: "سفارش {serviceType} با کد {code} در تاریخ {dateTime} توسط مدیر تایید شد. آدرس: {address} مشاهده سفارش: {orderLink}",
  in_progress: "سفارش {serviceType} با کد {code} در تاریخ {dateTime} در آدرس {address} در حال اجرا است. مشاهده سفارش: {orderLink}",
  executed: "سفارش {serviceType} با کد {code} در تاریخ {dateTime} در آدرس {address} اجرا شد. مشاهده سفارش: {orderLink}",
  awaiting_payment: "سفارش {serviceType} با کد {code} در آدرس {address} در انتظار پرداخت است. مبلغ: {amount} تومان. تاریخ: {dateTime} مشاهده سفارش: {orderLink}",
  paid: "پرداخت سفارش {serviceType} با کد {code} در تاریخ {dateTime} ثبت شد. آدرس: {address} مشاهده سفارش: {orderLink}",
  in_collection: "سفارش {serviceType} با کد {code} در تاریخ {dateTime} در آدرس {address} در حال جمع‌آوری است. مشاهده سفارش: {orderLink}",
  completed: "سفارش {serviceType} با کد {code} در تاریخ {dateTime} در آدرس {address} به پایان رسید. از اعتماد شما سپاسگزاریم. مشاهده سفارش: {orderLink}",
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
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, orderCode, orderId, status, serviceType, address, dateTime, amount }: SmsRequest = await req.json();
    
    console.log(`[send-order-sms] Received request - Phone: ${phone}, Order: ${orderCode}, Status: ${status}, Service: ${serviceType}, Address: ${address}, Amount: ${amount}`);

    // Validate inputs
    if (!phone || !orderCode || !status) {
      console.error("[send-order-sms] Missing required fields");
      return new Response(
        JSON.stringify({ error: "شماره تلفن، کد سفارش و وضعیت الزامی است" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if phone is in excluded list
    const normalizedPhone = phone.replace(/\s+/g, "").trim();
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

    // Get SMS template
    const template = SMS_TEMPLATES[status];
    if (!template) {
      console.error(`[send-order-sms] Unknown status: ${status}`);
      return new Response(
        JSON.stringify({ error: `وضعیت نامعتبر: ${status}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // تاریخ و زمان شمسی
    const persianDateTime = dateTime || formatPersianDateTime();
    
    // لینک سفارش
    const orderLink = orderId ? `https://ahrom.ir/orders/${orderId}` : "https://ahrom.ir/my-orders";
    
    // فرمت مبلغ
    const formattedAmount = amount ? amount.toLocaleString('fa-IR') : "تعیین نشده";
    
    // Replace placeholders in template
    let message = template
      .replace("{code}", orderCode)
      .replace("{serviceType}", serviceType || "خدمات")
      .replace("{address}", address || "ثبت نشده")
      .replace("{dateTime}", persianDateTime)
      .replace("{amount}", formattedAmount)
      .replace("{orderLink}", orderLink);
    
    console.log(`[send-order-sms] Sending message: ${message}`);

    // Get ParsGreen credentials
    const apiKey = Deno.env.get("PARSGREEN_API_KEY");
    const sender = Deno.env.get("PARSGREEN_SENDER");

    if (!apiKey || !sender) {
      console.error("[send-order-sms] ParsGreen credentials not configured");
      return new Response(
        JSON.stringify({ error: "تنظیمات پنل پیامکی انجام نشده است" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format phone number for ParsGreen (should be 98xxxxxxxxxx format)
    let formattedPhone = normalizedPhone;
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "98" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("98")) {
      formattedPhone = "98" + formattedPhone;
    }

    // Send SMS via ParsGreen API
    const parsGreenUrl = "https://sms.parsgreen.ir/Api/SendSMS.asmx/SendMessage";
    
    const params = new URLSearchParams();
    params.append("Ession", apiKey);
    params.append("Mession", message);
    params.append("Ession2", formattedPhone);
    params.append("Originator", sender);
    params.append("ReturnUDH", "0");
    params.append("ReturnBinary", "0");
    params.append("SmsClass", "1");
    params.append("UDH", "");

    console.log(`[send-order-sms] Calling ParsGreen API for phone: ${formattedPhone}`);

    const smsResponse = await fetch(parsGreenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const responseText = await smsResponse.text();
    console.log(`[send-order-sms] ParsGreen response: ${responseText}`);

    // Parse response - ParsGreen returns XML
    const isSuccess = responseText.includes("1") || smsResponse.ok;

    if (isSuccess) {
      console.log(`[send-order-sms] SMS sent successfully to ${formattedPhone}`);
      return new Response(
        JSON.stringify({ success: true, message: "پیامک با موفقیت ارسال شد" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      console.error(`[send-order-sms] Failed to send SMS: ${responseText}`);
      return new Response(
        JSON.stringify({ success: false, error: "خطا در ارسال پیامک", details: responseText }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

  } catch (error: any) {
    console.error("[send-order-sms] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
