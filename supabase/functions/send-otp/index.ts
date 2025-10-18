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
      // Security: Limit input length to prevent memory exhaustion
      if (input.length > 20) return '';
      
      // Keep only digits
      let raw = input.slice(0, 20).replace(/[^0-9]/g, '');
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
    
    // Security: Only allow test phones in development environment
    const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';
    const isTestPhone = isDevelopment && (phone_number.startsWith('aaa') || phone_number.startsWith('bbb'));
    
    let maskedPhone: string;
    
    if (isWhitelistedPhone || isTestPhone) {
      // For whitelisted/test phones, use as-is
      maskedPhone = normalizedPhone;
      console.log('Processing SPECIAL OTP request for:', maskedPhone);
      
      // For whitelisted/test phones, skip SMS sending - just store OTP in database
      // Use fixed code "12345" for whitelisted phones, "11111" for test phones
      const code = isWhitelistedPhone ? '12345' : '11111';
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
          message: 'کد تایید برای شماره مدیریتی آماده است'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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
    console.log('Processing OTP request for:', maskedPhone);
    
    const derivedEmail = `phone-${normalizedPhone}@ahrom.example.com`;

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

    // Save OTP to database (expires in 90 seconds)
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

    // Send SMS via Parsgreen UrlService (HTTP method)
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
    const allowedProductionHosts = ['ahrom.org'];
    const allowedProductionSuffixes = ['.ahrom.org'];
    
    // Only allow localhost/127.0.0.1 in development
    const isLocalhost = isDevelopment && (/^localhost$/.test(baseHost) || /^127\.0\.0\.1$/.test(baseHost));
    
    // Production: strict whitelist only
    // Development: allow localhost + lovableproject.com for testing
    const isProductionAllowed = allowedProductionHosts.includes(baseHost) || 
                                allowedProductionSuffixes.some(s => baseHost.endsWith(s));
    const isDevelopmentAllowed = isDevelopment && (baseHost.endsWith('.lovableproject.com'));
    
    const isAllowed = hostIsValidFormat && (isProductionAllowed || isLocalhost || isDevelopmentAllowed);
    
    if (!isAllowed) {
      console.warn('Invalid host attempt:', baseHost);
      return new Response(
        JSON.stringify({ error: 'دامنه نامعتبر' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const safeHost = baseHost;
    const webOtpBinding = `@${safeHost} #${code}`;
    // Simple format to avoid validation errors
    const message = `کد تایید شما: ${code} برای ورود به اهرم\n\n@${safeHost} #${code}\nلغو11`;
    const rawSender = Deno.env.get('PARSGREEN_SENDER') || '';
    const senderNumber = /^[0-9]+$/.test(rawSender) ? rawSender : '90000319';
    if (rawSender && !/^[0-9]+$/.test(rawSender)) {
      console.warn('PARSGREEN_SENDER is not numeric; falling back to default 90000319');
    }

    try {
      // Use Parsgreen correct API format
      const apiUrl = 'https://sms.parsgreen.ir/UrlService/sendSMS.ashx';
      
      const params = new URLSearchParams({
        from: senderNumber,
        to: normalizedPhone,
        text: message,
        signature: apiKey
      });

  console.log('Sending SMS to:', maskedPhone);
  // Don't log the full URL with API key in production
  if (Deno.env.get('ENVIRONMENT') !== 'production') {
    console.log('SMS API endpoint:', apiUrl);
  }
      
      const smsResponse = await fetch(`${apiUrl}?${params.toString()}`, {
        method: 'GET',
      });

      const responseText = await smsResponse.text();
      // Log only success/failure status, not full API response details
      console.log('SMS send attempt completed with status:', smsResponse.ok ? 'success' : 'failed');

      // Parsgreen returns different formats:
      // Success: شناسه عددی (numeric ID)
      // Or semicolon format: number;status;id where status could be 0 (queued) or 1 (sent)
      // Error: text message like "FilterationNotAllow" or other error strings
      
      const trimmedResponse = responseText.trim();
      const parts = trimmedResponse.split(';');
      
      // Check if it's a pure error message (contains text errors)
      const isError = trimmedResponse.toLowerCase().includes('error') || 
                      trimmedResponse.toLowerCase().includes('filteration') ||
                      trimmedResponse.includes('خطا') ||
                      trimmedResponse.toLowerCase().includes('request not valid');
      
      // If it has semicolons, check status (0 or 1 both mean SMS is processing/sent)
      const hasValidFormat = parts.length === 3 && /^[0-9;]+$/.test(trimmedResponse);
      
      if (!smsResponse.ok || (isError && !hasValidFormat)) {
        console.error('SMS send failed');
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } catch (fetchError) {
      console.error('Network error sending SMS');
      return new Response(
        JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OTP sent successfully to:', maskedPhone);

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