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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check rate limit
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_otp_rate_limit', { _phone_number: phone_number });

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
        phone_number,
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

    // Send SMS via Parsgreen using SOAP-style REST API
    const apiKey = Deno.env.get('PARSGREEN_API_KEY');
    const message = `کد تایید شما برای ورود به سایت اهـــــرم | ahrom: ${code}`;

    // Parsgreen uses their webservice endpoint
    const smsResponse = await fetch(`https://login.parsgreen.com/Api/SendSMS.asmx/SendSms2?Signature=${apiKey}&PhoneNumber=${phone_number}&Message=${encodeURIComponent(message)}&SenderNumber=90000319`, {
      method: 'GET',
    });

    const responseText = await smsResponse.text();

    if (!smsResponse.ok) {
      console.error('Error sending SMS:', responseText);
      return new Response(
        JSON.stringify({ error: 'خطا در ارسال پیامک' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if response contains error
    if (responseText.includes('Error') || responseText.includes('خطا')) {
      console.error('SMS API returned error:', responseText);
      return new Response(
        JSON.stringify({ error: 'خطا در ارسال پیامک' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OTP sent successfully to:', phone_number);

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