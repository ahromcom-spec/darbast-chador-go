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
      let raw = input.replace(/[^0-9]/g, '');
      if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
      else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
      else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
      else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
      if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
      return raw;
    };

    const normalizedPhone = normalizeIranPhone(phone_number);
    
    // Convert to E.164 format for Supabase Auth (+98XXXXXXXXXX)
    const authPhone = normalizedPhone.startsWith('0') 
      ? '+98' + normalizedPhone.slice(1) 
      : '+98' + normalizedPhone;

    const derivedEmail = `phone-${normalizedPhone}@ahrom.example.com`;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalize OTP code to ASCII digits (handles Persian/Arabic numerals)
    const normalizeOtpCode = (input: string) => {
      const persian = '۰۱۲۳۴۵۶۷۸۹';
      const arabic = '٠١٢٣٤٥٦٧٨٩';
      return String(input ?? '')
        .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
        .replace(/[^0-9]/g, '')
        .slice(0, 6);
    };
    const normalizedCode = normalizeOtpCode(code);
    // Build a strong per-login password from OTP to satisfy password policy
    const loginPassword = `otp-${normalizedCode}-x`;

    // Verify OTP using secure function
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

    // Mark OTP as verified
    await supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('phone_number', normalizedPhone)
      .eq('code', normalizedCode);

    // Check if user exists with this phone number or derived email
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userWithPhone = existingUser.users.find(u => u.phone === authPhone);
    const userWithEmail = existingUser.users.find(u => u.email === derivedEmail);
    
    const userExists = userWithPhone || userWithEmail;

    // If this is a login attempt and user doesn't exist, return error
    if (!is_registration && !userExists) {
      return new Response(
        JSON.stringify({ error: 'شماره موبایل ثبت نشده است. لطفا ابتدا ثبت نام کنید.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this is a registration attempt and user already exists, return error
    if (is_registration && userExists) {
      return new Response(
        JSON.stringify({ error: 'این شماره قبلاً ثبت نام کرده است. لطفا وارد شوید.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this is a login attempt and user doesn't exist, return error
    if (!is_registration && !userExists) {
      return new Response(
        JSON.stringify({ error: 'شماره موبایل ثبت نشده است. لطفا ابتدا ثبت نام کنید.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this is a registration attempt and user already exists, return error
    if (is_registration && userExists) {
      return new Response(
        JSON.stringify({ error: 'این شماره قبلاً ثبت نام کرده است. لطفا وارد شوید.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let session;

    // Helper to sign in with email, updating password if needed
    const signInWithEmail = async (email: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error) {
        // Ensure confirmed email and a valid password, then retry
        const target = existingUser.users.find(u => u.email === email);
        if (target) {
          await supabase.auth.admin.updateUserById(target.id, {
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

    if (userWithPhone) {
      // Attach an email and set a valid password, then sign in via email
      await supabase.auth.admin.updateUserById(userWithPhone.id, {
        password: loginPassword,
        email: derivedEmail,
        email_confirm: true,
        user_metadata: { ...(userWithPhone.user_metadata || {}), phone_number: normalizedPhone },
      });
      const { session: sess, error: emailErr } = await signInWithEmail(derivedEmail);
      if (emailErr) {
        console.error('Authentication error');
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      session = sess;
    } else if (userWithEmail) {
      // Existing email-mapped user
      const { session: sess, error: emailErr } = await signInWithEmail(derivedEmail);
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