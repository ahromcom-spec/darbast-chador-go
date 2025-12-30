import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CEO phone number (hardcoded for security)
const CEO_PHONE_NUMBER = '09125511494';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, purpose } = await req.json();

    if (action !== 'module_delete') {
      return new Response(
        JSON.stringify({ error: 'عملیات نامعتبر' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check rate limit
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_otp_rate_limit', { _phone_number: CEO_PHONE_NUMBER });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً ۵ دقیقه صبر کنید' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Always generate real 5-digit OTP code (never use fixed codes)
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    // Send SMS via Parsgreen
    const apiKey = Deno.env.get('PARSGREEN_API_KEY');
    
    if (!apiKey) {
      console.error('PARSGREEN_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const purposeText = purpose || 'حذف ماژول';
    const message = `اهرم: ${code} کد تایید برای ${purposeText}\n\n@ahrom.ir #${code}`;
    
    const rawSender = Deno.env.get('PARSGREEN_SENDER') || '';
    const senderNumber = /^[0-9]+$/.test(rawSender) ? rawSender : '90000319';

    let smsSent = false;
    try {
      const apiUrl = 'https://sms.parsgreen.ir/UrlService/sendSMS.ashx';

      const sendOnce = async (text: string) => {
        const params = new URLSearchParams({
          from: senderNumber,
          to: CEO_PHONE_NUMBER,
          text,
          signature: apiKey
        });

        const resp = await fetch(`${apiUrl}?${params.toString()}`, { method: 'GET' });
        const body = await resp.text();
        const trimmed = body.trim();
        const parts = trimmed.split(';');

        const pureNumeric = /^[0-9]+$/.test(trimmed);
        const hasSemicolonNumeric = parts.length === 3 && parts.every((p) => /^[0-9]+$/.test(p));

        const containsFilteration = trimmed.toLowerCase().includes('filteration');
        const looksError = trimmed.toLowerCase().includes('error') ||
                           trimmed.toLowerCase().includes('request not valid') ||
                           trimmed.includes('خطا');

        const okFormat = resp.ok && (pureNumeric || hasSemicolonNumeric) && !looksError;
        return { okFormat, containsFilteration, trimmed };
      };

      let result = await sendOnce(message);

      if (result.okFormat) {
        smsSent = true;
        console.log('CEO OTP SMS sent successfully');
      } else if (result.containsFilteration) {
        const fallbackMessage = `اهرم: ${code} کد تایید برای ${purposeText}`;
        const result2 = await sendOnce(fallbackMessage);
        if (result2.okFormat) {
          smsSent = true;
          console.log('CEO OTP SMS sent successfully (fallback)');
        } else {
          console.error('SMS send failed:', result2.trimmed.substring(0, 100));
          return new Response(
            JSON.stringify({ error: 'خطا در ارسال پیامک' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.error('SMS send failed:', result.trimmed.substring(0, 100));
        return new Response(
          JSON.stringify({ error: 'خطا در ارسال پیامک' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } catch (fetchError) {
      console.error('Network error sending SMS');
      return new Response(
        JSON.stringify({ error: 'خطا در ارسال پیامک' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save OTP to database
    if (smsSent) {
      const expiresAt = new Date(Date.now() + 90 * 1000);
      await supabase
        .from('otp_codes')
        .insert({
          phone_number: CEO_PHONE_NUMBER,
          code,
          expires_at: expiresAt.toISOString(),
          verified: false,
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'کد تایید به شماره مدیرعامل ارسال شد'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('CEO OTP error:', error);
    return new Response(
      JSON.stringify({ error: 'خطا در سیستم' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
