import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ahrom-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, phone_number, user_id, password, new_password, otp_code, email, email_code } = await req.json();

    // Normalize phone number
    const normalizePhone = (input: string) => {
      if (!input) return '';
      const persian = '۰۱۲۳۴۵۶۷۸۹';
      const arabic = '٠١٢٣٤٥٦٧٨٩';
      let raw = input
        .slice(0, 40)
        .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
        .replace(/[^0-9+]/g, '');
      if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
      else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
      else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
      else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
      if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
      return raw.replace(/[^0-9]/g, '');
    };

    const normalizedPhone = phone_number ? normalizePhone(phone_number) : null;

    // SET_PASSWORD: Set or update password for authenticated user
    if (action === 'set_password') {
      if (!user_id || !password) {
        return new Response(
          JSON.stringify({ error: 'شناسه کاربر و رمز عبور الزامی است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate password strength
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const passwordHash = await hashPassword(password);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          user_password_hash: passwordHash,
          password_set_at: new Date().toISOString()
        })
        .eq('user_id', user_id);

      if (updateError) {
        console.error('Error setting password:', updateError);
        return new Response(
          JSON.stringify({ error: 'خطا در ذخیره رمز عبور' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'رمز عبور با موفقیت ذخیره شد' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LOGIN_WITH_PASSWORD: Login using phone + user password
    if (action === 'login_with_password') {
      if (!normalizedPhone || !password) {
        return new Response(
          JSON.stringify({ error: 'شماره تلفن و رمز عبور الزامی است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user profile with password hash
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, user_password_hash, full_name')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: 'شماره تلفن یافت نشد' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profile.user_password_hash) {
        return new Response(
          JSON.stringify({ error: 'این حساب رمز عبور ندارد. لطفاً از کد تایید استفاده کنید.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValid = await verifyPassword(password, profile.user_password_hash);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'رمز عبور اشتباه است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create session using the same technique as verify-otp
      const derivedEmail = `phone-${normalizedPhone}@ahrom.example.com`;
      const loginPassword = `user-pwd-${normalizedPhone}-x`;

      // Update user password in auth.users to enable sign-in
      await supabase.auth.admin.updateUserById(profile.user_id, {
        password: loginPassword,
        email_confirm: true,
      });

      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: derivedEmail,
        password: loginPassword,
      });

      if (signInErr) {
        console.error('Sign in error:', signInErr);
        return new Response(
          JSON.stringify({ error: 'خطا در ورود به سیستم' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, session: signInData.session, message: 'ورود با موفقیت انجام شد' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CHECK_HAS_PASSWORD: Check if user has set a password
    if (action === 'check_has_password') {
      if (!normalizedPhone) {
        return new Response(
          JSON.stringify({ error: 'شماره تلفن الزامی است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_password_hash, recovery_email, recovery_email_verified')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          success: true, 
          has_password: !!profile?.user_password_hash,
          has_email: !!profile?.recovery_email,
          email_verified: !!profile?.recovery_email_verified
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RESET_PASSWORD_VIA_OTP: Reset password using SMS OTP
    if (action === 'reset_password_via_otp') {
      if (!normalizedPhone || !otp_code || !new_password) {
        return new Response(
          JSON.stringify({ error: 'شماره تلفن، کد تایید و رمز جدید الزامی است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify OTP
      const { data: otpValid } = await supabase.rpc('verify_otp_code', {
        _phone_number: normalizedPhone,
        _code: otp_code
      });

      if (!otpValid) {
        return new Response(
          JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update password
      const passwordHash = await hashPassword(new_password);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          user_password_hash: passwordHash,
          password_set_at: new Date().toISOString()
        })
        .eq('phone_number', normalizedPhone);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'خطا در بروزرسانی رمز عبور' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark OTP as used
      await supabase
        .from('otp_codes')
        .update({ verified: true })
        .eq('phone_number', normalizedPhone)
        .eq('code', otp_code);

      return new Response(
        JSON.stringify({ success: true, message: 'رمز عبور با موفقیت تغییر کرد' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SET_RECOVERY_EMAIL: Set email for password recovery
    if (action === 'set_recovery_email') {
      if (!user_id || !email) {
        return new Response(
          JSON.stringify({ error: 'شناسه کاربر و ایمیل الزامی است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ error: 'فرمت ایمیل نامعتبر است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user phone number
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', user_id)
        .maybeSingle();

      if (!profile?.phone_number) {
        return new Response(
          JSON.stringify({ error: 'پروفایل کاربر یافت نشد' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store email and code
      await supabase
        .from('profiles')
        .update({ 
          recovery_email: email,
          recovery_email_verified: false 
        })
        .eq('user_id', user_id);

      // Store verification code
      await supabase.from('email_verification_codes').insert({
        email,
        code: verificationCode,
        phone_number: profile.phone_number,
        purpose: 'email_verify'
      });

      // TODO: Send email with verification code (requires Resend setup)
      // For now, return the code (in production, this would be sent via email)
      console.log(`Email verification code for ${email}: ${verificationCode}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'کد تایید به ایمیل شما ارسال شد',
          // Remove this in production - only for testing
          debug_code: verificationCode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // VERIFY_EMAIL: Verify the recovery email
    if (action === 'verify_email') {
      if (!user_id || !email_code) {
        return new Response(
          JSON.stringify({ error: 'شناسه کاربر و کد تایید الزامی است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's recovery email
      const { data: profile } = await supabase
        .from('profiles')
        .select('recovery_email')
        .eq('user_id', user_id)
        .maybeSingle();

      if (!profile?.recovery_email) {
        return new Response(
          JSON.stringify({ error: 'ایمیل بازیابی تنظیم نشده است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the code
      const { data: isValid } = await supabase.rpc('verify_email_code', {
        _email: profile.recovery_email,
        _code: email_code,
        _purpose: 'email_verify'
      });

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark email as verified
      await supabase
        .from('profiles')
        .update({ recovery_email_verified: true })
        .eq('user_id', user_id);

      return new Response(
        JSON.stringify({ success: true, message: 'ایمیل با موفقیت تایید شد' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RESET_PASSWORD_VIA_EMAIL: Reset password using email verification
    if (action === 'reset_password_via_email') {
      if (!email || !email_code || !new_password) {
        return new Response(
          JSON.stringify({ error: 'ایمیل، کد تایید و رمز جدید الزامی است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify email code
      const { data: isValid } = await supabase.rpc('verify_email_code', {
        _email: email,
        _code: email_code,
        _purpose: 'password_reset'
      });

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user by recovery email
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('recovery_email', email)
        .eq('recovery_email_verified', true)
        .maybeSingle();

      if (!profile?.user_id) {
        return new Response(
          JSON.stringify({ error: 'ایمیل یافت نشد یا تایید نشده است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update password
      const passwordHash = await hashPassword(new_password);
      await supabase
        .from('profiles')
        .update({ 
          user_password_hash: passwordHash,
          password_set_at: new Date().toISOString()
        })
        .eq('user_id', profile.user_id);

      return new Response(
        JSON.stringify({ success: true, message: 'رمز عبور با موفقیت تغییر کرد' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SEND_EMAIL_RESET_CODE: Send password reset code to email
    if (action === 'send_email_reset_code') {
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'ایمیل الزامی است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if email exists and is verified
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('recovery_email', email)
        .eq('recovery_email_verified', true)
        .maybeSingle();

      if (!profile) {
        return new Response(
          JSON.stringify({ error: 'این ایمیل در سیستم ثبت نشده یا تایید نشده است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate 6-digit code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store the code
      await supabase.from('email_verification_codes').insert({
        email,
        code: resetCode,
        phone_number: profile.phone_number,
        purpose: 'password_reset'
      });

      // TODO: Send email with reset code (requires Resend setup)
      console.log(`Password reset code for ${email}: ${resetCode}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'کد بازیابی به ایمیل شما ارسال شد',
          // Remove this in production
          debug_code: resetCode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'عملیات نامعتبر' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Password management error:', error);
    return new Response(
      JSON.stringify({ error: 'خطا در سیستم مدیریت رمز عبور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
