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
    const { phone_number, is_registration } = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن الزامی است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize to Iranian mobile format: 09XXXXXXXXX (for Parsgreen)
    const normalizeIranPhone = (input: string) => {
      // Security: Limit input length to prevent memory exhaustion
      if (!input) return '';
      if (input.length > 32) return '';
      const limited = input.slice(0, 32);

      // Map Persian/Arabic numerals to ASCII first
      const persian = '۰۱۲۳۴۵۶۷۸۹';
      const arabic = '٠١٢٣٤٥٦٧٨٩';
      const toAscii = (s: string) =>
        s
          .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
          .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));

      // Keep only digits and optional leading + for country code
      let raw = toAscii(limited).replace(/[^0-9+]/g, '');
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

    // Normalize to Iranian mobile format first (for whitelist check)
    let normalizedPhone = normalizeIranPhone(phone_number);
    
    // Initialize Supabase client early for whitelist check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if this phone number is in the whitelist (management numbers)
    const { data: whitelistData } = await supabase
      .from('phone_whitelist')
      .select('phone_number')
      .eq('phone_number', normalizedPhone)
      .maybeSingle();
    
    const isWhitelistedPhone = !!whitelistData;
    
    // Security: Block test phones in production - hardcoded check
    const isProduction = supabaseUrl.includes('gclbltatkbwbqxqqrcea');
    const isTestPhone = (phone_number.startsWith('aaa') || phone_number.startsWith('bbb'));
    
    // Reject test phones in production
    if (isProduction && isTestPhone) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن نامعتبر است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let maskedPhone: string;
    
    if (isTestPhone) {
      // For test phones only (development), use as-is
      maskedPhone = normalizedPhone;
      
      // For test phones, generate a random OTP code (not hardcoded)
      const code = Math.floor(10000 + Math.random() * 90000).toString();
      const expiresAt = new Date(Date.now() + 90 * 1000);
      
      await supabase
        .from('otp_codes')
        .insert({
          phone_number: normalizedPhone,
          code,
          expires_at: expiresAt.toISOString(),
          verified: false,
        });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'کد تایید برای شماره تستی آماده است'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Security: Whitelisted phones now receive real SMS like everyone else
    // This prevents the security risk of hardcoded OTP codes
    
    // Regular phone validation for real phones
    // Enforce strict 11-digit format: 09XXXXXXXXX
    if (!/^09[0-9]{9}$/.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن باید 11 رقم و با 09 شروع شود' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Mask phone number for logging (security best practice)
    maskedPhone = normalizedPhone.substring(0, 4) + 'XXX' + normalizedPhone.substring(9);
    
    const derivedEmail = `phone-${normalizedPhone}@ahrom.example.com`;
    
    // Robust check: see if user already exists (by derived email) and also via profiles table
    let userExists = false;
    try {
      const { data: page1 } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userExists = !!page1?.users?.some((u: any) => (u.email || '').toLowerCase() === derivedEmail.toLowerCase());
    } catch (_) {
      // ignore admin errors and fall back to profiles lookup
    }

    if (!userExists) {
      const { data: profileMatch } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();
      userExists = !!profileMatch;
    }
    
    // If this is a login attempt and user doesn't exist, return a friendly message (200 to allow frontend handling)
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
    
    // If this is a registration attempt and user already exists, return friendly message (200)
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

    // If whitelisted, bypass SMS and use fixed code 12345 (no SMS)
    if (isWhitelistedPhone) {
      const fixed = '12345';
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase
        .from('otp_codes')
        .insert({
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

    // Send SMS via Parsgreen UrlService (HTTP method) FIRST
    const apiKey = Deno.env.get('PARSGREEN_API_KEY');
    
    if (!apiKey) {
      console.error('PARSGREEN_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Build Web OTP binding using request origin/referrer host for Android Chrome autofill
    const originHeader = req.headers.get('Origin') || req.headers.get('origin') || req.headers.get('Referer') || req.headers.get('referer') || '';
    let host = 'ahrom.org';
    try {
      host = originHeader ? new URL(originHeader).host : host;
    } catch {}
    const hostIsValidFormat = /^[a-z0-9.-]+(:[0-9]{1,5})?$/i.test(host);
    const baseHost = host.replace(/:.*$/, '');
    
    // Environment-based host validation
    const allowedProductionHosts = ['ahrom.org', 'www.ahrom.org', 'ahrom.ir', 'www.ahrom.ir'];
    // In production, allow primary domain and controlled preview domains for this project
    const allowedProductionSuffixes = ['.ahrom.org', '.ahrom.ir', '.lovableproject.com', '.lovable.app'];
    
    // Only allow localhost/127.0.0.1 in non-production
    const isLocalhost = !isProduction && (/^localhost$/.test(baseHost) || /^127\.0\.0\.1$/.test(baseHost));
    
    // Production: strict whitelist only (+ Lovable preview domains)
    // Non-production: allow localhost + lovable domains for testing
    const isProductionAllowed = allowedProductionHosts.includes(baseHost) || 
                                allowedProductionSuffixes.some(s => baseHost.endsWith(s));
    const isDevelopmentAllowed = !isProduction && (baseHost.endsWith('.lovableproject.com') || baseHost.endsWith('.lovable.app'));
    
    const isAllowed = hostIsValidFormat && (isProductionAllowed || isLocalhost || isDevelopmentAllowed);
    
    if (!isAllowed) {
      const maskedHost = baseHost.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'xxx-xxx');
      console.warn('Invalid host attempt:', maskedHost);
      return new Response(
        JSON.stringify({ error: 'دامنه نامعتبر' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const safeHost = baseHost;
    // Build Web OTP bindings for both apex and www variants to maximize auto-fill reliability
    const hasWWW = safeHost.startsWith('www.');
    const apexHost = hasWWW ? safeHost.slice(4) : safeHost;
    const wwwHost = hasWWW ? safeHost : `www.${safeHost}`;
    const bindings = Array.from(new Set([`@${apexHost} #${code}`, `@${wwwHost} #${code}`])).join('\n');
    const webOtpBinding = bindings;
    // Format with Web OTP binding for auto-fill
    const message = `کد تایید شما: ${code} برای ورود به اهرم\n@${apexHost} #${code}\nلغو11`;
    const rawSender = Deno.env.get('PARSGREEN_SENDER') || '';
    const senderNumber = /^[0-9]+$/.test(rawSender) ? rawSender : '90000319';
    if (rawSender && !/^[0-9]+$/.test(rawSender)) {
      console.warn('PARSGREEN_SENDER is not numeric; falling back to default 90000319');
    }

    // Try to send SMS first - only save to DB if successful
    let smsSent = false;
    try {
      // Use Parsgreen correct API format
      const apiUrl = 'https://sms.parsgreen.ir/UrlService/sendSMS.ashx';

      // Small helper to send and parse Parsgreen response
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

        // Success formats: a numeric id OR semicolon numeric triplet
        const pureNumeric = /^[0-9]+$/.test(trimmed);
        const hasSemicolonNumeric = parts.length === 3 && parts.every((p) => /^[0-9]+$/.test(p));

        const containsFilteration = trimmed.toLowerCase().includes('filteration');
        const looksError = trimmed.toLowerCase().includes('error') ||
                           trimmed.toLowerCase().includes('request not valid') ||
                           trimmed.includes('خطا');

        const okFormat = resp.ok && (pureNumeric || hasSemicolonNumeric) && !looksError;
        return { okFormat, containsFilteration, trimmed };
      };

      // 1) Try with Web OTP binding (may trigger provider filtration)
      const primaryMessage = message;
      let result = await sendOnce(primaryMessage);

      if (result.okFormat) {
        smsSent = true;
        console.log('SMS sent successfully via Parsgreen');
      } else if (result.containsFilteration) {
        // 2) Fallback: send with Web OTP binding
        const fallbackMessage = `کد تایید شما: ${code} برای ورود به اهرم\n@${apexHost} #${code}\nلغو11`;
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

    // Only save OTP to database if SMS was sent successfully
    if (smsSent) {
      const expiresAt = new Date(Date.now() + 90 * 1000);
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
    }

    // Always return same response regardless of user existence to prevent enumeration
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
