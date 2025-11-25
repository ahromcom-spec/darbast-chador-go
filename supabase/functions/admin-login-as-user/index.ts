import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the user is admin or CEO using admin client to bypass RLS
    console.log('Checking roles for user:', user.id);
    
    // First check all roles for this user
    const { data: allRoles, error: allRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id);
    
    console.log('All roles for user:', { userId: user.id, allRoles, allRolesError });
    
    // Then filter for admin roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'ceo', 'general_manager']);

    console.log('User roles check:', { userId: user.id, roles, rolesError, allRolesCount: allRoles?.length });

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'خطا در بررسی دسترسی' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roles || roles.length === 0) {
      console.log('User does not have required roles');
      return new Response(
        JSON.stringify({ error: 'فقط مدیران می‌توانند به حساب کاربران دیگر دسترسی داشته باشند' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { target_user_id } = await req.json();

    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: 'target_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Attempting to get target user:', target_user_id);

    // Get target user data
    const { data: targetUserData, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
    
    console.log('Target user fetch result:', { targetUserData, targetUserError });
    
    if (targetUserError || !targetUserData) {
      console.error('Error fetching target user:', targetUserError);
      return new Response(
        JSON.stringify({ error: 'کاربر یافت نشد: ' + (targetUserError?.message || 'unknown error') }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log this action in audit_log
    await supabaseClient
      .from('audit_log')
      .insert({
        actor_user_id: user.id,
        action: 'admin_login_as_user',
        entity: 'users',
        entity_id: target_user_id,
        meta: {
          admin_user_id: user.id,
          target_user_id: target_user_id,
          timestamp: new Date().toISOString(),
        },
      });

    // Use admin.updateUserById to set metadata and then create session
    console.log('Creating impersonation session for:', target_user_id);

    // Get user's email/phone for session creation
    const userEmail = targetUserData.user.email || `temp-${target_user_id}@ahrom.local`;
    
    // Generate OTP for the user - this will give us a token
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    console.log('OTP generation result:', { otpData, otpError });

    if (otpError || !otpData) {
      return new Response(
        JSON.stringify({ error: 'خطا در ایجاد توکن ورود: ' + (otpError?.message || 'unknown') }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the token from the magic link
    const actionLink = otpData.properties.action_link;
    const urlParams = new URLSearchParams(actionLink.split('?')[1]);
    const accessToken = urlParams.get('token');
    const type = urlParams.get('type');

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'خطا در استخراج توکن' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange the token for a session using admin verifyOtp
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: otpData.properties.hashed_token,
      type: 'magiclink',
    });

    console.log('Session verification result:', { sessionData, sessionError });

    if (sessionError || !sessionData || !sessionData.session) {
      return new Response(
        JSON.stringify({ error: 'خطا در ایجاد session: ' + (sessionError?.message || 'unknown') }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
        user: sessionData.user,
        original_admin_id: user.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-login-as-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
