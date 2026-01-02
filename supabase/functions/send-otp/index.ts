import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pre-initialize Supabase client at module level to reduce cold start
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Normalize phone helper - defined once
const normalizeIranPhone = (input: string) => {
  if (!input) return '';
  if (input.length > 32) return '';
  const limited = input.slice(0, 32);
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const toAscii = (s: string) =>
    s.replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
     .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
  let raw = toAscii(limited).replace(/[^0-9+]/g, '');
  if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
  else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
  else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
  else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
  if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
  return raw;
};

// Check if production
const isProduction = supabaseUrl.includes('gclbltatkbwbqxqqrcea');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, is_registration } = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن الزامی است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizeIranPhone(phone_number);
    
    // Security: Block test phones in production
    const isTestPhone = (phone_number.startsWith('aaa') || phone_number.startsWith('bbb'));
    
    if (isProduction && isTestPhone) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن نامعتبر است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // For test phones in development
    if (isTestPhone) {
      const code = Math.floor(10000 + Math.random() * 90000).toString();
      const expiresAt = new Date(Date.now() + 90 * 1000);
      await supabase.from('otp_codes').insert({
        phone_number: normalizedPhone,
        code,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });
      return new Response(
        JSON.stringify({ success: true, message: 'کد تایید برای شماره تستی آماده است' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate phone format
    if (!/^09[0-9]{9}$/.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن باید 11 رقم و با 09 شروع شود' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Run whitelist, profile check, and rate limit in PARALLEL for speed
    const [whitelistResult, profileResult, rateLimitResult] = await Promise.all([
      supabase.from('phone_whitelist').select('phone_number').eq('phone_number', normalizedPhone).maybeSingle(),
      supabase.from('profiles').select('id').eq('phone_number', normalizedPhone).maybeSingle(),
      supabase.rpc('check_otp_rate_limit', { _phone_number: normalizedPhone })
    ]);
    
    const isWhitelistedPhone = !!whitelistResult.data;
    const userExists = !!profileResult.data;

    // Check rate limit
    if (rateLimitResult.error) {
      console.error('Rate limit check error:', rateLimitResult.error);
    }
    if (!rateLimitResult.data) {
      return new Response(
        JSON.stringify({ error: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً 5 دقیقه صبر کنید' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If this is a login attempt and user doesn't exist
    if (!is_registration && !userExists) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'این شماره در سامانه ثبت نشده است',
          user_exists: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If this is a registration attempt and user already exists
    if (is_registration && userExists) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'این شماره قبلاً در سامانه ثبت شده است',
          user_exists: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If whitelisted, bypass SMS and use fixed code 12345
    if (isWhitelistedPhone) {
      const fixed = '12345';
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase.from('otp_codes').insert({
        phone_number: normalizedPhone,
        code: fixed,
        expires_at: expiresAt,
        verified: false,
      });
      return new Response(
        JSON.stringify({ success: true, user_exists: userExists, whitelisted: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 5-digit OTP code
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    // Get Parsgreen API key
    const apiKey = Deno.env.get('PARSGREEN_API_KEY');
    if (!apiKey) {
      console.error('PARSGREEN_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get sender number
    const rawSender = Deno.env.get('PARSGREEN_SENDER') || '';
    const senderNumber = /^[0-9]+$/.test(rawSender) ? rawSender : '90000319';
    if (rawSender && !/^[0-9]+$/.test(rawSender)) {
      console.warn('PARSGREEN_SENDER is not numeric; falling back to default 90000319');
    }

    // Format message with Web OTP binding
    const message = `اهرم: ${code} کد تایید\n\n@ahrom.ir #${code}`;

    // Send SMS via Parsgreen
    let smsSent = false;
    try {
      const apiUrl = 'https://sms.parsgreen.ir/UrlService/sendSMS.ashx';

      const sendOnce = async (text: string) => {
        const params = new URLSearchParams({
          from: senderNumber,
          to: normalizedPhone,
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

      // Try with Web OTP binding first
      let result = await sendOnce(message);

      if (result.okFormat) {
        smsSent = true;
        console.log('SMS sent successfully via Parsgreen');
      } else if (result.containsFilteration) {
        // Fallback: send simple message without Web OTP binding
        const fallbackMessage = `اهرم: ${code} کد تایید`;
        const result2 = await sendOnce(fallbackMessage);
        if (result2.okFormat) {
          smsSent = true;
          console.log('SMS sent successfully via Parsgreen (fallback content)');
        } else {
          console.error('SMS send failed - Parsgreen error. Response:', result2.trimmed.substring(0, 100));
          return new Response(
            JSON.stringify({ error: 'خطا در ارسال پیامک. لطفا دوباره تلاش کنید.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.error('SMS send failed - Parsgreen error. Response:', result.trimmed.substring(0, 100));
        return new Response(
          JSON.stringify({ error: 'خطا در ارسال پیامک. لطفا دوباره تلاش کنید.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } catch (fetchError) {
      console.error('Network error sending SMS');
      return new Response(
        JSON.stringify({ error: 'خطا در ارسال پیامک. لطفا دوباره تلاش کنید.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save OTP to database if SMS was sent successfully
    if (smsSent) {
      const expiresAt = new Date(Date.now() + 90 * 1000);
      const { error: dbError } = await supabase.from('otp_codes').insert({
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
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'کد تایید با موفقیت ارسال شد'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Authentication system error');
    return new Response(
      JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
