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

    // Normalize to Iranian mobile format: 09XXXXXXXXX (for Parsgreen)
    const normalizeIranPhone = (input: string) => {
      // Keep only digits
      let raw = input.replace(/[^0-9]/g, '');
      // Remove common country prefixes
      if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
      else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
      else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
      else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
      // If 10 digits starting with 9, add leading zero
      if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
      // Return 11-digit format: 09XXXXXXXXX
      return raw;
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

    // Save OTP to database (expires in 9 seconds)
    const expiresAt = new Date(Date.now() + 9 * 1000);
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

    // Send SMS via Parsgreen UrlService (HTTP method)
    const apiKey = Deno.env.get('PARSGREEN_API_KEY');
    
    if (!apiKey) {
      console.error('PARSGREEN_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'خطا در تنظیمات سرویس پیامک' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const message = `کد تایید شما: ${code}`;
    const senderNumber = '90000319';

    try {
      // Use Parsgreen UrlService method
      const smsUrl = `http://sms.parsgreen.ir/UrlService/sendSMS.ashx?` +
        `from=${encodeURIComponent(senderNumber)}` +
        `&to=${encodeURIComponent(normalizedPhone)}` +
        `&text=${encodeURIComponent(message)}` +
        `&signature=${encodeURIComponent(apiKey)}`;

      console.log('Sending SMS to:', normalizedPhone);
      
      const smsResponse = await fetch(smsUrl, {
        method: 'GET',
      });

      const responseText = await smsResponse.text();
      console.log('Parsgreen Response:', responseText);

      // Check for errors in response
      if (!smsResponse.ok || responseText.includes('Error') || responseText.includes('خطا')) {
        console.error('SMS send failed:', responseText);
        return new Response(
          JSON.stringify({ error: 'خطا در ارسال پیامک - لطفا تنظیمات پنل را بررسی کنید' }),
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