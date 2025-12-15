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

// SMS templates for each order status
const SMS_TEMPLATES: Record<string, string> = {
  submitted: "سفارش شما با کد {code} در اهرم ثبت شد و در انتظار تایید است.",
  approved: "سفارش شما با کد {code} توسط مدیر تایید شد.",
  in_progress: "سفارش شما با کد {code} در حال اجرا است.",
  executed: "سفارش شما با کد {code} اجرا شد.",
  awaiting_payment: "سفارش شما با کد {code} در انتظار پرداخت است.",
  paid: "پرداخت سفارش شما با کد {code} ثبت شد.",
  in_collection: "سفارش شما با کد {code} در حال جمع‌آوری است.",
  completed: "سفارش شما با کد {code} تکمیل شد. از اعتماد شما سپاسگزاریم.",
};

interface SmsRequest {
  phone: string;
  orderCode: string;
  status: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, orderCode, status }: SmsRequest = await req.json();
    
    console.log(`[send-order-sms] Received request - Phone: ${phone}, Order: ${orderCode}, Status: ${status}`);

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

    // Replace placeholders in template
    const message = template.replace("{code}", orderCode);
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
