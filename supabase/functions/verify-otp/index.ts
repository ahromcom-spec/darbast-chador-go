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
    const { phone_number, code, full_name } = await req.json();

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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify OTP using secure function
    const { data: isValid, error: verifyError } = await supabase
      .rpc('verify_otp_code', { 
        _phone_number: normalizedPhone, 
        _code: code 
      });

    if (verifyError) {
      console.error('OTP verification error:', verifyError);
      return new Response(
        JSON.stringify({ error: 'خطا در تایید کد' }),
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
      .eq('code', code);

    // Check if user exists with this phone number
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userWithPhone = existingUser.users.find(u => u.phone === authPhone);

    let session;
    
    if (userWithPhone) {
      // User exists, sign them in
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: authPhone,
        password: code, // Using OTP as temporary password
      });

      if (error) {
        // If password doesn't match, update it
        await supabase.auth.admin.updateUserById(userWithPhone.id, {
          password: code,
        });
        
        // Try signing in again
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
          phone: authPhone,
          password: code,
        });

        if (retryError) {
          console.error('Error signing in:', retryError);
          return new Response(
            JSON.stringify({ error: 'خطا در ورود به سیستم' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        session = retryData.session;
      } else {
        session = data.session;
      }
    } else {
      // User doesn't exist, create new user
      const { data, error } = await supabase.auth.admin.createUser({
        phone: authPhone,
        password: code,
        phone_confirm: true,
        user_metadata: {
          full_name: full_name || '',
          phone_number: normalizedPhone,
        },
      });

      if (error) {
        console.error('Error creating user:', error);
        return new Response(
          JSON.stringify({ error: 'خطا در ایجاد حساب کاربری' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Sign in the new user
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        phone: authPhone,
        password: code,
      });

      if (signInError) {
        console.error('Error signing in new user:', signInError);
        return new Response(
          JSON.stringify({ error: 'خطا در ورود به سیستم' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      session = signInData.session;
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
    console.error('Error in verify-otp function:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});