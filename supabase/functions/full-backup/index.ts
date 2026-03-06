import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables to backup - ordered by dependency
const BACKUP_TABLES = [
  'profiles',
  'user_roles',
  'phone_whitelist',
  'provinces',
  'districts',
  'regions',
  'customers',
  'locations',
  'service_categories',
  'service_activity_types',
  'service_types_v3',
  'subcategories',
  'activity_types',
  'organizational_positions',
  'projects_hierarchy',
  'projects_v3',
  'order_approvals',
  'order_messages',
  'order_payments',
  'order_daily_logs',
  'order_collaborators',
  'order_transfer_requests',
  'order_renewals',
  'collection_requests',
  'collection_request_messages',
  'daily_reports',
  'daily_report_orders',
  'daily_report_staff',
  'daily_report_order_media',
  'daily_report_date_locks',
  'project_media',
  'project_progress_stages',
  'project_progress_media',
  'approved_media',
  'bank_cards',
  'bank_card_transactions',
  'wallet_transactions',
  'module_assignments',
  'module_hierarchy_states',
  'module_shortcuts',
  'hr_employees',
  'notifications',
  'contractors',
  'contractor_profiles',
  'contractor_verification_requests',
  'internal_staff_profiles',
  'invoices',
  'payments',
  'services',
  'inventory_items',
  'inventory_reservations',
  'expert_pricing_requests',
  'expert_pricing_request_media',
  'call_logs',
  'audit_log',
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user is CEO
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is CEO
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isCEO = roles?.some(r => r.role === 'ceo' || r.role === 'admin' || r.role === 'general_manager');
    if (!isCEO) {
      return new Response(JSON.stringify({ error: "دسترسی فقط برای مدیرعامل" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all tables using service role (bypasses RLS)
    const backup: Record<string, any[]> = {};
    const errors: string[] = [];

    for (const table of BACKUP_TABLES) {
      try {
        // Fetch all rows (handle >1000 rows with pagination)
        let allRows: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await serviceClient
            .from(table)
            .select("*")
            .range(from, from + pageSize - 1)
            .order('created_at', { ascending: false });

          if (error) {
            // Try without ordering if created_at doesn't exist
            const { data: data2, error: error2 } = await serviceClient
              .from(table)
              .select("*")
              .range(from, from + pageSize - 1);

            if (error2) {
              errors.push(`${table}: ${error2.message}`);
              hasMore = false;
            } else {
              allRows = allRows.concat(data2 || []);
              hasMore = (data2?.length || 0) === pageSize;
              from += pageSize;
            }
          } else {
            allRows = allRows.concat(data || []);
            hasMore = (data?.length || 0) === pageSize;
            from += pageSize;
          }
        }

        backup[table] = allRows;
      } catch (err) {
        errors.push(`${table}: ${(err as Error).message}`);
      }
    }

    const backupData = {
      version: 1,
      created_at: new Date().toISOString(),
      created_by: user.id,
      tables: backup,
      table_counts: Object.fromEntries(
        Object.entries(backup).map(([k, v]) => [k, v.length])
      ),
      total_records: Object.values(backup).reduce((sum, arr) => sum + arr.length, 0),
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(backupData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
