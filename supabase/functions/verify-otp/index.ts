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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check OTP code
    const { data: otpData, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpData) {
      console.error('Invalid or expired OTP:', otpError);
      return new Response(
        JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', otpData.id);

    // Check if user exists with this phone number
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userWithPhone = existingUser.users.find(u => u.phone === phone_number);

    let session;
    
    if (userWithPhone) {
      // User exists, sign them in
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: phone_number,
        password: code, // Using OTP as temporary password
      });

      if (error) {
        // If password doesn't match, update it
        await supabase.auth.admin.updateUserById(userWithPhone.id, {
          password: code,
        });
        
        // Try signing in again
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
          phone: phone_number,
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
        phone: phone_number,
        password: code,
        phone_confirm: true,
        user_metadata: {
          full_name: full_name || '',
          phone_number: phone_number,
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
        phone: phone_number,
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