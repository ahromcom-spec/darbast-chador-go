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
    const { phone_number, full_name, registered_by } = await req.json();

    if (!phone_number || !full_name) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن و نام الزامی است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
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

    const normalizedPhone = normalizeIranPhone(phone_number);
    
    if (!/^09[0-9]{9}$/.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: 'شماره تلفن باید 11 رقم و با 09 شروع شود' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // بررسی دسترسی کاربر ثبت‌کننده
    if (registered_by) {
      // بررسی نقش CEO/GM/Admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', registered_by)
        .in('role', ['ceo', 'general_manager', 'admin']);

      const hasRoleAccess = roles && roles.length > 0;

      if (!hasRoleAccess) {
        // بررسی اختصاص ماژول
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', registered_by)
          .single();

        if (!profile?.phone_number) {
          return new Response(
            JSON.stringify({ error: 'دسترسی به این عملیات ندارید' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: assignment } = await supabase
          .from('module_assignments')
          .select('id')
          .eq('module_key', 'site_registration')
          .eq('assigned_phone_number', profile.phone_number)
          .eq('is_active', true)
          .single();

        if (!assignment) {
          return new Response(
            JSON.stringify({ error: 'دسترسی به این ماژول ندارید' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const derivedEmail = `phone-${normalizedPhone}@ahrom.example.com`;
    const randomPassword = `reg-${normalizedPhone}-${Date.now()}`;

    // بررسی وجود کاربر
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('phone_number', normalizedPhone)
      .maybeSingle();

    if (existingProfile?.user_id) {
      return new Response(
        JSON.stringify({ error: 'این شماره قبلاً ثبت‌نام شده است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ایجاد کاربر جدید
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: derivedEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { 
        full_name: full_name, 
        phone_number: normalizedPhone,
        registered_by_module: true,
      },
    });

    if (createErr) {
      console.error('User creation error:', createErr);
      return new Response(
        JSON.stringify({ error: 'خطا در ایجاد حساب کاربری' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ایجاد رکورد customer
    if (created?.user) {
      await supabase
        .from('customers')
        .insert({ user_id: created.user.id });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'کاربر با موفقیت ثبت‌نام شد',
        user_id: created?.user?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: 'خطا در سیستم ثبت‌نام' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
