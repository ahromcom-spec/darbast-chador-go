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
    const isTestPhone = (phone_number.startsWith('aaa') || phone_number.startsWith('bbb'));
    
    // Reject test phones in production
    if (isProduction && isTestPhone) {
      return new Response(
        JSON.stringify({ error: 'شماره تستی در محیط تولید مجاز نیست' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      const persian = '۰۱۲۳۴۵۶۷۸۹';
      const arabic = '٠١٢٣٤٥٦٧٨٩';
      return String(input ?? '')
        .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
        .replace(/[^0-9]/g, '')
        .slice(0, 5); // Changed from 6 to 5 to match send-otp
    };
    const normalizedCode = normalizeOtpCode(code);
    // Build a strong per-login password from OTP to satisfy password policy
    const loginPassword = `otp-${normalizedCode}-x`;

    // For test phones only, bypass OTP verification if code is 12345
    if (isTestPhone) {
      // Check if code is the test code (12345)
      if (normalizedCode !== '12345') {
        return new Response(
          JSON.stringify({ error: 'کد تایید نامعتبر است. برای شماره‌های تست از کد 12345 استفاده کنید.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if phone is in whitelist
      const { data: whitelistData } = await supabase
        .from('phone_whitelist')
        .select('phone_number, allowed_roles')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();
      
      if (!whitelistData) {
        return new Response(
          JSON.stringify({ error: 'شماره تستی در لیست مجاز نیست' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Security: No phone logging
    } else {
      // For whitelisted management phones, accept code 12345
      // For regular phones, use proper OTP verification
      if (isWhitelistedPhone && normalizedCode === '12345') {
        // Whitelisted phones can use test code 12345 for easy access
        // Security: No phone logging
      } else {
        // Regular OTP verification for real phones (including whitelisted with non-12345 codes)
        const { data: isValid, error: verifyError } = await supabase
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

        if (!isValid) {
          return new Response(
            JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark OTP as verified for real phones
        await supabase
          .from('otp_codes')
          .update({ verified: true })
          .eq('phone_number', normalizedPhone)
          .eq('code', normalizedCode);
      }
    }

    // Check if user exists with derived email
    let userWithEmail: any = null;
    let existingUserId: string | null = null;
    try {
      // Prefer direct lookup by email to avoid heavy list calls (prevents quota issues)
      // @ts-ignore - getUserByEmail is available in admin API on this runtime
      const { data: byEmail } = await (supabase.auth.admin as any).getUserByEmail?.(derivedEmail) || {};
      if (byEmail?.user) {
        userWithEmail = byEmail.user;
        existingUserId = byEmail.user.id;
      }
    } catch (_) {
      // Fallback (rare): no-op. We intentionally avoid listUsers to respect quotas
    }
    const userExists = !!userWithEmail;

    // Security: Add random delay to prevent timing attacks (50-150ms)
    const randomDelay = Math.floor(Math.random() * 100) + 50;
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Do not reveal user existence. Try sign-in path first; if it fails we'll create or recover.
    // This avoids heavy admin list calls and prevents quota issues.

    // For registration attempts, prevent duplicate signups
    if (is_registration && userExists) {
      return new Response(
        JSON.stringify({ error: 'این شماره قبلاً ثبت نام کرده است. لطفا وارد شوید.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    let session;

    // Helper to sign in with email, updating password if needed
    const signInWithEmail = async (email: string, userId?: string | null) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error) {
        // Ensure confirmed email and a valid password, then retry if we know the user id
        if (userId) {
          await supabase.auth.admin.updateUserById(userId, {
            password: loginPassword,
            email_confirm: true,
          });
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
            email,
            password: loginPassword,
          });
          if (retryError) {
            console.error('Sign in error');
            return { session: null, error: retryError };
          }
          return { session: retryData.session, error: null };
        }
        return { session: null, error };
      }
      return { session: data.session, error: null };
    };

    if (userWithEmail) {
      // Existing email-mapped user
      const { session: sess, error: emailErr } = await signInWithEmail(derivedEmail, existingUserId);
      if (emailErr) {
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      session = sess;
    } else {
      // Create new user with derived email (no phone provider needed)
      const { data, error } = await supabase.auth.admin.createUser({
        email: derivedEmail,
        password: loginPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || '',
          phone_number: normalizedPhone,
        },
      });

      if (error) {
        console.error('User creation error');
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Sign in the new user via email
      const { session: sess, error: emailErr } = await signInWithEmail(derivedEmail);
      if (emailErr) {
        console.error('Authentication error');
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      session = sess;
      
      // If this is a test phone or whitelisted phone, automatically assign roles from whitelist
      if (isTestPhone || isWhitelistedPhone) {
        const { data: whitelistData } = await supabase
          .from('phone_whitelist')
          .select('allowed_roles')
          .eq('phone_number', normalizedPhone)
          .maybeSingle();
        
        if (whitelistData?.allowed_roles && data.user) {
          // Insert roles for the new user
          const roleInserts = whitelistData.allowed_roles.map((role: string) => ({
            user_id: data.user.id,
            role: role
          }));
          
          await supabase
            .from('user_roles')
            .insert(roleInserts);
        }
      }
    }

    // Clean up old OTP codes
    await supabase.rpc('cleanup_expired_otps');

    return new Response(
      JSON.stringify({ 
        success: true, 
        session,
        message: 'ورود با موفقیت انجام شد' 
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