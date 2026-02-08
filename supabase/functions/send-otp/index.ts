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
const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const toAsciiDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));

const normalizeIranPhone = (input: string) => {
  if (!input) return '';
  if (input.length > 32) return '';
  const limited = input.slice(0, 32);
  let raw = toAsciiDigits(limited).replace(/[^0-9+]/g, '');
  if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
  else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
  else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
  else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
  if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
  return raw;
};

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 7) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
};

// Check if production
const isProduction = supabaseUrl.includes('gclbltatkbwbqxqqrcea');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, is_registration, force_sms } = await req.json();

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

    // If whitelisted AND NOT forcing SMS, bypass SMS and use fixed code 12345
    // When force_sms=true (e.g., CEO selecting "دریافت کد تایید پیامکی"), send real OTP
    if (isWhitelistedPhone && !force_sms) {
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
    
    // Log when forcing SMS for whitelisted phone
    if (isWhitelistedPhone && force_sms) {
      console.log('INFO: Forcing real SMS for whitelisted phone', maskPhone(normalizedPhone));
    }

    // Generate 5-digit OTP code
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();

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
    // Note: trim + ascii-digit conversion to avoid issues with whitespace/newlines/persian digits
    const rawSender = toAsciiDigits((Deno.env.get('PARSGREEN_SENDER') || '').trim());
    const senderNumber = /^[0-9]+$/.test(rawSender) ? rawSender : '90000319';
    if (rawSender && !/^[0-9]+$/.test(rawSender)) {
      console.warn('PARSGREEN_SENDER is not numeric; falling back to default 90000319');
    }

    // پیامک OTP با فرمت Web OTP API برای autofill خودکار در مرورگر و گوشی
    // فرمت استاندارد: متن + خط جدید + @domain #code
    // این فرمت به مرورگر اجازه می‌دهد کد را اتوماتیک شناسایی و پر کند
    const plainMessage = `اهرم: ${code} کد تایید\n\n@ahrom.ir #${code}`;

    // Start SMS sending AND database insert in PARALLEL for maximum speed
    const sendSmsPromise = (async () => {
      const apiUrl = 'https://sms.parsgreen.ir/UrlService/sendSMS.ashx';

      const fetchWithTimeout = async (url: string, timeoutMs = 12000) => {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await fetch(url, { method: 'GET', signal: controller.signal });
        } finally {
          clearTimeout(t);
        }
      };

      const sendOnce = async (text: string) => {
        const params = new URLSearchParams({
          from: senderNumber,
          to: normalizedPhone,
          text,
          signature: apiKey
        });

        let resp: Response;
        let trimmed = '';
        try {
          resp = await fetchWithTimeout(`${apiUrl}?${params.toString()}`);
          const body = await resp.text();
          trimmed = body.trim();
        } catch (e) {
          // Network/timeout errors should not crash the whole auth flow
          console.error('Parsgreen fetch failed:', (e as any)?.message ?? e);
          return { okFormat: false, containsFilteration: false, trimmed: 'fetch_error' };
        }

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

       // Send plain content first for maximum deliverability.
       let result = await sendOnce(plainMessage);

      if (result.okFormat) {
        console.log('INFO SMS sent successfully via Parsgreen', {
          to: maskPhone(normalizedPhone),
          from: senderNumber,
          provider: result.trimmed.substring(0, 120),
           mode: 'plain',
        });
        return { success: true };
      } else if (result.containsFilteration) {
         // Fallback: try an even simpler wording (in case provider flags the default string)
         const result2 = await sendOnce(`کد تایید اهرم: ${code}`);
        if (result2.okFormat) {
          console.log('INFO SMS sent successfully via Parsgreen (fallback content)', {
            to: maskPhone(normalizedPhone),
            from: senderNumber,
            provider: result2.trimmed.substring(0, 120),
          });
          return { success: true };
        } else {
          console.error('SMS send failed - Parsgreen error. Response:', result2.trimmed.substring(0, 100));
          return { success: false, error: 'خطا در ارسال پیامک. لطفا دوباره تلاش کنید.' };
        }
      } else {
        console.error('SMS send failed - Parsgreen error. Response:', result.trimmed.substring(0, 100));
        return { success: false, error: 'خطا در ارسال پیامک. لطفا دوباره تلاش کنید.' };
      }
    })();

    // Insert OTP to database in parallel with SMS
    const dbInsertPromise = supabase.from('otp_codes').insert({
      phone_number: normalizedPhone,
      code,
      expires_at: expiresAt,
      verified: false,
    });

    // Wait for both operations
    const [smsResult, dbResult] = await Promise.all([sendSmsPromise, dbInsertPromise]);

    if (!smsResult.success) {
      // Delete the OTP code since SMS failed
      await supabase.from('otp_codes').delete().eq('phone_number', normalizedPhone).eq('code', code);
      return new Response(
        JSON.stringify({ error: smsResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (dbResult.error) {
      console.error('Error saving OTP:', dbResult.error);
      return new Response(
        JSON.stringify({ error: 'خطا در ذخیره کد تایید' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'کد تایید با موفقیت ارسال شد'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Authentication system error:', (error as any)?.message ?? error);
    return new Response(
      JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
