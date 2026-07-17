import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * User-scoped backup edge function.
 * Returns only data the calling user can see (RLS is enforced by using their JWT).
 * For each table we use anonClient.from(table).select('*') so RLS filters automatically.
 */
const USER_BACKUP_TABLES = [
  'profiles',
  'customers',
  'projects_hierarchy',
  'projects_v3',
  'order_approvals',
  'order_messages',
  'order_payments',
  'order_daily_logs',
  'order_collaborators',
  'order_renewals',
  'collection_requests',
  'daily_reports',
  'daily_report_orders',
  'daily_report_staff',
  'daily_report_order_media',
  'project_media',
  'project_progress_stages',
  'project_progress_media',
  'approved_media',
  'bank_cards',
  'bank_card_transactions',
  'wallet_transactions',
  'hr_employees',
  'notifications',
  'invoices',
  'payments',
  'expert_pricing_requests',
  'expert_pricing_request_media',
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    // RLS-respecting client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Restrict strictly to the CEO phone number
    const CEO_PHONE = '09125511494';
    const { data: profile } = await userClient
      .from("profiles")
      .select("phone_number")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile || (profile.phone_number || '').toString().trim() !== CEO_PHONE) {
      return new Response(JSON.stringify({ error: "دسترسی فقط برای مدیرعامل" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backup: Record<string, any[]> = {};
    const errors: string[] = [];

    for (const table of USER_BACKUP_TABLES) {
      try {
        let allRows: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await userClient
            .from(table)
            .select("*")
            .range(from, from + pageSize - 1);
          if (error) {
            errors.push(`${table}: ${error.message}`);
            hasMore = false;
            break;
          }
          allRows = allRows.concat(data || []);
          hasMore = (data?.length || 0) === pageSize;
          from += pageSize;
        }
        backup[table] = allRows;
      } catch (err) {
        errors.push(`${table}: ${(err as Error).message}`);
      }
    }

    const payload = {
      version: 1,
      scope: "user",
      created_at: new Date().toISOString(),
      created_by: user.id,
      tables: backup,
      table_counts: Object.fromEntries(
        Object.entries(backup).map(([k, v]) => [k, v.length])
      ),
      total_records: Object.values(backup).reduce((s, a) => s + a.length, 0),
      errors: errors.length ? errors : undefined,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
