import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Resend client
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Function to send email via Resend
async function sendVerificationEmail(email: string, code: string, type: 'email_verify' | 'password_reset'): Promise<boolean> {
  if (!resend) {
    console.log(`[DEV] Email code for ${email}: ${code}`);
    return true; // Return true in dev mode so flow continues
  }
  
  const subject = type === 'email_verify' 
    ? 'تأیید ایمیل - اهرم' 
    : 'بازیابی رمز عبور - اهرم';
    
  const htmlContent = type === 'email_verify' 
    ? `
      <div style="direction: rtl; text-align: right; font-family: Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f59e0b;">تأیید ایمیل بازیابی</h2>
        <p>با سلام،</p>
        <p>کد تأیید شما برای ثبت ایمیل بازیابی:</p>
        <div style="background: #fef3c7; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #d97706;">${code}</span>
        </div>
        <p>این کد تا ۱۰ دقیقه معتبر است.</p>
        <p>اگر شما این درخواست را ارسال نکرده‌اید، لطفاً این ایمیل را نادیده بگیرید.</p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">© اهرم - سامانه مدیریت خدمات داربست</p>
      </div>
    `
    : `
      <div style="direction: rtl; text-align: right; font-family: Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f59e0b;">بازیابی رمز عبور</h2>
        <p>با سلام،</p>
        <p>کد بازیابی رمز عبور شما:</p>
        <div style="background: #fef3c7; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #d97706;">${code}</span>
        </div>
        <p>این کد تا ۱۰ دقیقه معتبر است.</p>
        <p>اگر شما این درخواست را ارسال نکرده‌اید، لطفاً این ایمیل را نادیده بگیرید.</p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">© اهرم - سامانه مدیریت خدمات داربست</p>
      </div>
    `;

  try {
    const { error } = await resend.emails.send({
      from: 'اهرم <noreply@ahrom.ir>',
      to: [email],
      subject,
      html: htmlContent,
    });
    
    if (error) {
      console.error('Resend error:', error);
      return false;
    }
    
    console.log(`Email sent successfully to ${email}`);
    return true;
  } catch (err) {
    console.error('Email sending failed:', err);
    return false;
  }
}

// Password hashing using PBKDF2-SHA256 with per-user random salt
// Format: pbkdf2$<iterations>$<saltBase64>$<hashBase64>
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEYLEN = 32; // bytes

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, keyLen: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    keyLen * 8
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
}

// Constant-time comparison
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Legacy SHA-256 + static salt verification (for backward compatibility only)
async function legacyVerify(password: string, hash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ahrom-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === hash;
}

async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (storedHash && storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return { valid: false, needsRehash: false };
    const iterations = parseInt(parts[1], 10);
    const salt = base64ToBytes(parts[2]);
    const expected = base64ToBytes(parts[3]);
    const derived = await pbkdf2(password, salt, iterations, expected.length);
    return { valid: timingSafeEqual(derived, expected), needsRehash: iterations < PBKDF2_ITERATIONS };
  }
  // Legacy format — verify and signal that the hash should be upgraded on success
  const ok = await legacyVerify(password, storedHash);
  return { valid: ok, needsRehash: ok };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, phone_number, password, new_password, otp_code, email, email_code } = body;
    let { user_id } = body;

    // Actions that require an authenticated caller acting on their own account
    const SELF_AUTH_ACTIONS = new Set([
      'set_password',
      'set_recovery_email',
      'verify_email',
    ]);

    let authedUserId: string | null = null;
    if (SELF_AUTH_ACTIONS.has(action)) {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'احراز هویت الزامی است' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'نشست نامعتبر است' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authedUserId = userData.user.id;
      // Force user_id to be the verified caller, ignore any client-supplied value
      user_id = authedUserId;
    }

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

      const { valid: isValid, needsRehash } = await verifyPassword(password, profile.user_password_hash);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'رمز عبور اشتباه است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transparently upgrade legacy/weak hashes to PBKDF2 with random salt
      if (needsRehash) {
        try {
          const upgraded = await hashPassword(password);
          await supabase
            .from('profiles')
            .update({ user_password_hash: upgraded })
            .eq('user_id', profile.user_id);
        } catch (e) {
          console.error('Password rehash failed (non-fatal):', e);
        }
      }

      // Rotate legacy predictable password to a random opaque secret on first
      // login after the fix, so the account can never again be signed into via
      // a phone-derived password. Idempotent via user_metadata.pw_rotated.
      try {
        const { data: userInfo } = await supabase.auth.admin.getUserById(profile.user_id);
        const meta = (userInfo?.user?.user_metadata as any) || {};
        if (meta.pw_rotated !== true) {
          const randBytes = new Uint8Array(48);
          crypto.getRandomValues(randBytes);
          let bin = '';
          for (let i = 0; i < randBytes.length; i++) bin += String.fromCharCode(randBytes[i]);
          const newSecret = (btoa(bin).replace(/[^A-Za-z0-9]/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 64);
          await supabase.auth.admin.updateUserById(profile.user_id, {
            password: newSecret,
            user_metadata: { ...meta, pw_rotated: true },
          });
        }
      } catch (e) {
        console.error('Password rotation skipped:', e);
      }

      // Issue session via admin-generated magic link (no predictable password).
      const derivedEmail = `phone-${normalizedPhone}@ahrom.example.com`;

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: derivedEmail,
      });
      const tokenHash = (linkData as any)?.properties?.hashed_token;
      if (linkErr || !tokenHash) {
        console.error('Magic link generation error:', linkErr);
        return new Response(
          JSON.stringify({ error: 'خطا در ورود به سیستم' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const anonClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: signInData, error: signInErr } = await anonClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });

      if (signInErr || !signInData?.session) {
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

      // Send email with verification code
      const emailSent = await sendVerificationEmail(email, verificationCode, 'email_verify');
      
      if (!emailSent) {
        return new Response(
          JSON.stringify({ error: 'خطا در ارسال ایمیل. لطفاً مجدداً تلاش کنید.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'کد تایید به ایمیل شما ارسال شد'
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

      // Send email with reset code
      const emailSent = await sendVerificationEmail(email, resetCode, 'password_reset');
      
      if (!emailSent) {
        return new Response(
          JSON.stringify({ error: 'خطا در ارسال ایمیل. لطفاً مجدداً تلاش کنید.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'کد بازیابی به ایمیل شما ارسال شد'
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
