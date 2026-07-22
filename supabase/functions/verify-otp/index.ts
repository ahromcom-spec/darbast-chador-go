import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
// رمز ثابت برای شماره‌های لیست سفید - از متغیر محیطی خوانده می‌شود
const WHITELIST_FIXED_PASSWORD = Deno.env.get('WHITELIST_PASSWORD');

// Cryptographically random, non-guessable password. Never derived from public
// attributes like phone numbers. Used only as the auth account's opaque secret;
// sessions are issued via admin-generated magic links, not password sign-in.
function randomSecret(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/[^A-Za-z0-9]/g, '') + crypto.randomUUID();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, code, full_name, is_registration, is_password_login, action } = await req.json();

    if (!phone_number || (action !== 'check_whitelist' && !code)) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن و کد/رمز عبور الزامی است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize to Iranian mobile format: 09XXXXXXXXX (same as send-otp)
    const normalizeIranPhone = (input: string) => {
      if (input.length > 40) return '';
      const persian = '۰۱۲۳۴۵۶۷۸۹';
      const arabic = '٠١٢٣٤٥٦٧٨٩';
      const normalizedDigits = input
        .slice(0, 40)
        .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
      let raw = normalizedDigits.replace(/[^0-9+]/g, '');
      if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
      else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
      else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
      else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
      if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
      raw = raw.replace(/[^0-9]/g, '');
      return raw;
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);

    // Issue a Supabase session for a given email without relying on a password.
    // Uses admin-generated magic-link token_hash exchanged via anon client's
    // verifyOtp. This means we never need to know or store a predictable
    // password, and existing sessions on other devices are NOT invalidated.
    const issueSessionForEmail = async (email: string) => {
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      const tokenHash = (linkData as any)?.properties?.hashed_token;
      if (linkErr || !tokenHash) {
        return { session: null, error: linkErr || new Error('magic link generation failed') };
      }
      const { data, error } = await anonClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      return { session: data?.session ?? null, error };
    };

    // Lazily rotate legacy predictable passwords to a random secret on next
    // successful login. Uses user_metadata.pw_rotated as an idempotency flag
    // so we only invalidate password-grant sessions once per user.
    const rotateLegacyPasswordIfNeeded = async (userId: string | null | undefined) => {
      if (!userId) return;
      try {
        const { data: userInfo } = await supabase.auth.admin.getUserById(userId);
        const meta = (userInfo?.user?.user_metadata as any) || {};
        if (meta.pw_rotated === true) return;
        await supabase.auth.admin.updateUserById(userId, {
          password: randomSecret(),
          user_metadata: { ...meta, pw_rotated: true },
        });
      } catch (e) {
        console.error('Password rotation skipped:', e);
      }
    };

    const isProduction = supabaseUrl.includes('gclbltatkbwbqxqqrcea');
    const isTestPhone = (phone_number.startsWith('aaa') || phone_number.startsWith('bbb'));

    if (action !== 'check_whitelist' && isProduction && isTestPhone) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن نامعتبر است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let normalizedPhone: string;
    let authPhone: string;

    if (isTestPhone) {
      normalizedPhone = phone_number;
      authPhone = phone_number;
    } else {
      normalizedPhone = normalizeIranPhone(phone_number);
      if (!/^09[0-9]{9}$/.test(normalizedPhone)) {
        return new Response(
          JSON.stringify({ error: 'شماره تلفن باید 11 رقم و با 09 شروع شود' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authPhone = normalizedPhone.startsWith('0')
        ? '+98' + normalizedPhone.slice(1)
        : '+98' + normalizedPhone;
    }

    const derivedEmail = `phone-${normalizedPhone}@ahrom.example.com`;

    const { data: whitelistRows } = await supabase
      .from('phone_whitelist')
      .select('phone_number, allowed_roles')
      .limit(1000);

    const whitelistData = (whitelistRows ?? []).find((row: any) => {
      const rowPhone = typeof row?.phone_number === 'string' ? row.phone_number : '';
      return normalizeIranPhone(rowPhone) === normalizedPhone;
    }) ?? null;

    const isWhitelistedPhone = !!whitelistData;

    if (action === 'check_whitelist') {
      return new Response(
        JSON.stringify({ success: true, is_whitelisted: isWhitelistedPhone }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Whitelist password login
    if (is_password_login) {
      if (!WHITELIST_FIXED_PASSWORD) {
        console.error('WHITELIST_PASSWORD environment variable not configured');
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isWhitelistedPhone) {
        return new Response(
          JSON.stringify({ error: 'این شماره مجاز به ورود با رمز عبور نیست' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (code !== WHITELIST_FIXED_PASSWORD) {
        return new Response(
          JSON.stringify({ error: 'رمز عبور اشتباه است' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ensure the auth account exists (create with random opaque password).
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      let createdUser: any = null;
      if (!existingProfile?.user_id) {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: derivedEmail,
          password: randomSecret(),
          email_confirm: true,
          user_metadata: { full_name: full_name || '', phone_number: normalizedPhone },
        });
        if (createErr) {
          console.error('User creation error');
          return new Response(
            JSON.stringify({ error: 'خطا در ایجاد حساب کاربری' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        createdUser = created?.user ?? null;

        if (whitelistData?.allowed_roles && createdUser) {
          const roleInserts = whitelistData.allowed_roles.map((role: string) => ({
            user_id: createdUser.id,
            role,
          }));
          await supabase.from('user_roles').insert(roleInserts);
        }
      }

      // Rotate legacy predictable password for existing users on first login.
      if (existingProfile?.user_id) {
        await rotateLegacyPasswordIfNeeded(existingProfile.user_id);
      }

      const { session, error: issueErr } = await issueSessionForEmail(derivedEmail);
      if (issueErr || !session) {
        console.error('Session issue error:', issueErr);
        return new Response(
          JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, session, message: 'ورود با موفقیت انجام شد' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize OTP code
    const normalizeOtpCode = (input: string) => {
      if (!input || typeof input !== 'string') return '';
      const limited = input.slice(0, 20);
      const persian = '۰۱۲۳۴۵۶۷۸۹';
      const arabic = '٠١٢٣٤٥٦٧٨٩';
      const normalized = limited
        .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
        .replace(/[^0-9]/g, '');
      return normalized.length === 5 ? normalized : '';
    };

    const normalizedCode = normalizeOtpCode(code);
    if (!normalizedCode) {
      return new Response(
        JSON.stringify({ error: 'کد تایید باید دقیقاً 5 رقم باشد' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: otpResult } = await supabase.rpc('verify_otp_code', {
      _phone_number: normalizedPhone,
      _code: normalizedCode
    });

    const isValid = (isWhitelistedPhone && normalizedCode === '12345') || !!otpResult;

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified (non-blocking)
    supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('phone_number', normalizedPhone)
      .eq('code', normalizedCode)
      .then(() => {});

    let session: any = null;
    let createdUserId: string | null = null;

    if (is_registration) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: derivedEmail,
        password: randomSecret(),
        email_confirm: true,
        user_metadata: { full_name: full_name || '', phone_number: normalizedPhone },
      });

      if (createErr) {
        console.error('User creation error');
        return new Response(
          JSON.stringify({ error: 'خطا در احراز هویت. لطفا دوباره تلاش کنید.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      createdUserId = created?.user?.id ?? null;

      if ((isTestPhone || isWhitelistedPhone) && whitelistData?.allowed_roles && created?.user) {
        const roleInserts = whitelistData.allowed_roles.map((role: string) => ({
          user_id: created.user.id,
          role,
        }));
        await supabase.from('user_roles').insert(roleInserts);
      }
    } else {
      // Login flow — auto-provision account if missing (for whitelist/test)
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (!profile?.user_id) {
        if (isWhitelistedPhone || isTestPhone) {
          const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: derivedEmail,
            password: randomSecret(),
            email_confirm: true,
            user_metadata: { full_name: full_name || '', phone_number: normalizedPhone },
          });
          if (createErr) {
            console.error('User creation error');
            return new Response(
              JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          createdUserId = created?.user?.id ?? null;
        } else {
          return new Response(
            JSON.stringify({ error: 'اطلاعات ورود نامعتبر است' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const { session: issued, error: issueErr } = await issueSessionForEmail(derivedEmail);
    if (issueErr || !issued) {
      console.error('Session issue error:', issueErr);
      return new Response(
        JSON.stringify({ error: 'خطا در سیستم احراز هویت' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    session = issued;

    // Clean up old OTP codes in background (non-blocking)
    Promise.resolve(supabase.rpc('cleanup_expired_otps')).catch(() => {});

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
