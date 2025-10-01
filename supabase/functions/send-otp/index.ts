import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number } = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن الزامی است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize Iranian mobile to +98XXXXXXXXXX format
    const normalizeIranPhone = (input: string) => {
      // Keep only digits
      let raw = input.replace(/[^0-9]/g, '');
      // Remove common country prefixes
      if (raw.startsWith('0098')) raw = raw.slice(4);
      else if (raw.startsWith('098')) raw = raw.slice(3);
      else if (raw.startsWith('98')) raw = raw.slice(2);
      // Remove leading zero for national format
      if (raw.length === 11 && raw.startsWith('0')) raw = raw.slice(1);
      // If 10 digits and starts with 9, it's a valid mobile
      if (raw.length === 10 && raw.startsWith('9')) return '+98' + raw;
      // Fallback: try to coerce to +98 format
      return '+98' + raw.replace(/^0+/, '');
    };

    const normalizedPhone = normalizeIranPhone(phone_number);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check rate limit
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_otp_rate_limit', { _phone_number: normalizedPhone });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً 5 دقیقه صبر کنید' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 5-digit OTP code
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    // Save OTP to database (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const { error: dbError } = await supabase
      .from('otp_codes')
      .insert({
        phone_number: normalizedPhone,
        code,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (dbError) {
      console.error('Error saving OTP:', dbError);
      return new Response(
        JSON.stringify({ error: 'خطا در ذخیره کد تایید' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS via Parsgreen using POST method
    const apiKey = Deno.env.get('PARSGREEN_API_KEY');
    
    if (!apiKey) {
      console.error('PARSGREEN_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'خطا در تنظیمات سرویس پیامک' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const message = `کد تایید شما برای ورود به سایت اهـــــرم | ahrom: ${code}`;

    try {
      // Try POST method first
      const smsResponse = await fetch('https://login.parsgreen.com/Api/SendSMS.asmx/SendSms2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'Signature': apiKey,
          'PhoneNumber': normalizedPhone,
          'Message': message,
          'SenderNumber': '90000319'
        }),
      });

      const responseText = await smsResponse.text();
      console.log('SMS API Response:', responseText);

      if (!smsResponse.ok) {
        console.error('Error sending SMS via POST:', responseText);
        
        // Fallback to GET method
        const fallbackResponse = await fetch(`https://login.parsgreen.com/Api/SendSMS.asmx/SendSms2?Signature=${apiKey}&PhoneNumber=${encodeURIComponent(normalizedPhone)}&Message=${encodeURIComponent(message)}&SenderNumber=90000319`, {
          method: 'GET',
        });

        const fallbackText = await fallbackResponse.text();
        console.log('SMS API Fallback Response:', fallbackText);

        if (!fallbackResponse.ok || fallbackText.includes('Error') || fallbackText.includes('خطا')) {
          console.error('Both POST and GET methods failed:', fallbackText);
          return new Response(
            JSON.stringify({ error: 'خطا در ارسال پیامک - لطفا API Key را بررسی کنید' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (responseText.includes('Error') || responseText.includes('خطا')) {
        console.error('SMS API returned error via POST:', responseText);
        return new Response(
          JSON.stringify({ error: 'خطا در ارسال پیامک - API Key نامعتبر است' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (fetchError) {
      console.error('Network error sending SMS:', fetchError);
      return new Response(
        JSON.stringify({ error: 'خطا در اتصال به سرویس پیامک' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OTP sent successfully to:', normalizedPhone);

    return new Response(
      JSON.stringify({ success: true, message: 'کد تایید با موفقیت ارسال شد' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-otp function:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});