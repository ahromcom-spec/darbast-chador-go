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
    const { phone_number, code, full_name, is_registration } = await req.json();

    if (!phone_number || !code) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن و کد تایید الزامی است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize to Iranian mobile format: 09XXXXXXXXX (same as send-otp)
    const normalizeIranPhone = (input: string) => {
      // Security: Limit input length to prevent memory exhaustion
      if (input.length > 20) return '';
      
      let raw = input.slice(0, 20).replace(/[^0-9]/g, '');
      if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
      else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
      else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
      else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
      if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
      return raw;
    };

    // Initialize Supabase client first (needed for whitelist check)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Security: Block test phones in production - hardcoded check
    const isProduction = supabaseUrl.includes('gclbltatkbwbqxqqrcea');
    // Test phones include: aaa*, bbb*, and special pattern test numbers (repeating digits)
    const isTestPhone = (
      phone_number.startsWith('aaa') || 
      phone_number.startsWith('bbb') ||
      /^(091{8}|092{8}|093{8}|094{8}|095{8}|096{8}|0901{8}|09012{8}|09013{8}|09014{8}|09015{8}|09016{8})/.test(phone_number)
    );
    
    // Reject test phones in production
    if (isProduction && isTestPhone) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن نامعتبر است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let normalizedPhone: string;
    let authPhone: string;
    let isWhitelistedPhone = false;
    
    if (isTestPhone) {
      // For test phones, use as-is without validation
      normalizedPhone = phone_number;
      authPhone = phone_number; // No E.164 conversion for test phones
    } else {
      // Regular phone validation for real phones
      normalizedPhone = normalizeIranPhone(phone_number);
      // Enforce strict 11-digit format: 09XXXXXXXXX
      if (!/^09[0-9]{9}$/.test(normalizedPhone)) {
        return new Response(
          JSON.stringify({ error: 'شماره تلفن باید 11 رقم و با 09 شروع شود' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Convert to E.164 format for Supabase Auth (+98XXXXXXXXXX)
      authPhone = normalizedPhone.startsWith('0') 
        ? '+98' + normalizedPhone.slice(1) 
        : '+98' + normalizedPhone;
      
      // Check if this phone number is in the whitelist (management numbers)
      const { data: whitelistData } = await supabase
        .from('phone_whitelist')
        .select('phone_number')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();
      
      isWhitelistedPhone = !!whitelistData;
    }

    const derivedEmail = `phone-${normalizedPhone}@ahrom.example.com`;

    // Normalize OTP code to ASCII digits (handles Persian/Arabic numerals)
    const normalizeOtpCode = (input: string) => {
      if (!input || typeof input !== 'string') {
        return '';
      }
      
      // Limit input length for security
      const limitedInput = input.slice(0, 20);
      
      const persian = '۰۱۲۳۴۵۶۷۸۹';
      const arabic = '٠١٢٣٤٥٦٧٨٩';
      
      const normalized = limitedInput
        .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
        .replace(/[^0-9]/g, '');
      
      // Must be exactly 5 digits
      if (normalized.length !== 5) {
        return '';
      }
      
      return normalized;
    };
    
    const normalizedCode = normalizeOtpCode(code);
    
    // Validate OTP code length
    if (!normalizedCode || normalizedCode.length !== 5) {
      return new Response(
        JSON.stringify({ error: 'کد تایید باید دقیقاً 5 رقم باشد' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Build a strong per-login password from OTP to satisfy password policy
    const loginPassword = `otp-${normalizedCode}-x`;

    // For whitelisted phone numbers, allow fixed test code 12345
    let isValid = false;
    if (isWhitelistedPhone && normalizedCode === '12345') {
      // Allow fixed test code for whitelisted numbers
      isValid = true;
    } else {
      // Verify OTP from database for all other cases
      const { data: otpValid, error: verifyError } = await supabase
        .rpc('verify_otp_code', { 
          _phone_number: normalizedPhone, 
          _code: normalizedCode 
        });

      if (verifyError) {
        console.error('OTP verification error');
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      isValid = !!otpValid;
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('phone_number', normalizedPhone)
      .eq('code', normalizedCode);

    // Auth: attempt password sign-in first, then create/recover as needed
    let session;

    const signInDirect = async (email: string) => {
      return await supabase.auth.signInWithPassword({ email, password: loginPassword });
    };

    // Small random delay to reduce timing side-channels
    const randomDelay = Math.floor(Math.random() * 100) + 50;
    await new Promise((r) => setTimeout(r, randomDelay));

    if (is_registration) {
      // Registration flow: prevent duplicate signups
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: derivedEmail,
        password: loginPassword,
        email_confirm: true,
        user_metadata: { full_name: full_name || '', phone_number: normalizedPhone },
      });

      if (createErr) {
        // Security: Use generic error message to prevent user enumeration
        console.error('User creation error');
        return new Response(
          JSON.stringify({ error: 'خطا در احراز هویت. لطفا دوباره تلاش کنید.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: signInData, error: signInErr } = await signInDirect(derivedEmail);
      if (signInErr) {
        console.error('Authentication error');
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      session = signInData.session;

      // Assign roles from whitelist for special phones
      if (isTestPhone || isWhitelistedPhone) {
        const { data: whitelistData } = await supabase
          .from('phone_whitelist')
          .select('allowed_roles')
          .eq('phone_number', normalizedPhone)
          .maybeSingle();
        if (whitelistData?.allowed_roles && created?.user) {
          const roleInserts = whitelistData.allowed_roles.map((role: string) => ({
            user_id: created.user.id,
            role,
          }));
          await supabase.from('user_roles').insert(roleInserts);
        }
      }
    } else {
      // Login flow
      const { data: signInData, error: signInErr } = await signInDirect(derivedEmail);
      if (!signInErr && signInData?.session) {
        session = signInData.session;
      } else {
        // If sign-in failed, try to recover the account password if user exists
        // Avoid costly list calls unless necessary
        if (isWhitelistedPhone || isTestPhone) {
          // Auto-provision for whitelisted/test numbers
          const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: derivedEmail,
            password: loginPassword,
            email_confirm: true,
            user_metadata: { full_name: full_name || '', phone_number: normalizedPhone },
          });
          if (!createErr) {
            const { data: retry, error: retryErr } = await signInDirect(derivedEmail);
            if (retryErr) {
              console.error('Authentication error');
              return new Response(
                JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            session = retry.session;
          } else {
            // If already exists, fall through to recovery
          }
        }

        if (!session) {
          // Last resort: lookup by phone in profiles to avoid quota-heavy listUsers
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('phone_number', normalizedPhone)
            .maybeSingle();

          if (profileErr || !profile?.user_id) {
            return new Response(
              JSON.stringify({ error: 'اطلاعات ورود نامعتبر است' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          await supabase.auth.admin.updateUserById(profile.user_id, {
            password: loginPassword,
            email_confirm: true,
          });

          const { data: retry, error: retryErr } = await signInDirect(derivedEmail);
          if (retryErr) {
            console.error('Sign in error');
            return new Response(
              JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          session = retry.session;
        }
      }
    }

    // Clean up old OTP codes
    await supabase.rpc('cleanup_expired_otps');

    return new Response(
      JSON.stringify({ success: true, session, message: 'ورود با موفقیت انجام شد' }),
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