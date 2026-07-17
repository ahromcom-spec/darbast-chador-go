// Direct database export — bypass UI, authenticate via secret header.
// Usage:
//   curl -H "x-export-key: $EXPORT_SECRET_KEY" \
//     "https://<project>.supabase.co/functions/v1/export-db-direct?tables=profiles,orders" \
//     -o export.json
//
// Query params:
//   tables=a,b,c  → only export these tables (default: all PUBLIC_TABLES)
//   table=foo     → export a single table (returned as a flat array)
//
// Response: application/json
//   { exported_at, counts: {table: n}, tables: { table: [rows...] } }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPORT_SECRET_KEY = Deno.env.get("EXPORT_SECRET_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-export-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Same list as export-database — kept in sync.
const PUBLIC_TABLES = [
  "activity_types","addresses","approved_media","assignments","assistant_chat_messages",
  "audit_log","bank_card_transactions","bank_cards","call_logs","collection_request_messages",
  "collection_requests","contractor_profiles","contractor_services","contractor_verification_requests",
  "contractors","customers","daily_report_date_locks","daily_report_order_media","daily_report_orders",
  "daily_report_staff","daily_reports","districts","email_verification_codes","expert_pricing_request_media",
  "expert_pricing_requests","hr_employees","internal_staff_profiles","inventory_items","inventory_reservations",
  "invoices","locations","module_assignments","module_edit_locks","module_hierarchy_states","module_shortcuts",
  "module_version_history","najva_subscriptions","notifications","order_approvals","order_collaborators",
  "order_daily_logs","order_messages","order_payments","order_renewals","order_transfer_requests","orders",
  "organizational_positions","otp_codes","payments","phone_whitelist","profile_photos","profiles",
  "project_assignments","project_collaborators","project_hierarchy_media","project_media",
  "project_progress_media","project_progress_stages","projects","projects_hierarchy","projects_v2",
  "projects_v3","provinces","push_subscriptions","rating_criteria","rating_helpful_votes","rating_responses",
  "ratings","regions","repair_request_media","repair_request_messages","repair_requests","reputation_scores",
  "scaffolding_requests","service_activity_types","service_categories","service_line_items","service_media",
  "service_requests","service_requests_v2","service_types","service_types_v3","services","services_v3",
  "site_analytics","site_sessions","staff_profiles","staff_roles","staff_salary_settings",
  "staff_verification_requests","staff_whitelist","subcategories","ticket_attachments","ticket_messages",
  "tickets","user_roles","voice_call_signals","wallet_transactions","workflow_tasks",
];

const PAGE_SIZE = 1000;

// deno-lint-ignore no-explicit-any
async function fetchAllRows(admin: any, table: string): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.warn(`skip ${table}: ${error.message}`);
      return all;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// Constant-time string compare to mitigate timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!EXPORT_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: EXPORT_SECRET_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Accept the key only via the x-export-key header — never via URL query params
    // (URL params leak into access logs, browser history, and Referer headers).
    const url = new URL(req.url);
    const providedKey = req.headers.get("x-export-key") ?? "";

    if (!providedKey || !safeEqual(providedKey, EXPORT_SECRET_KEY)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Single-table fast path: returns a flat array.
    const single = url.searchParams.get("table");
    if (single) {
      if (!PUBLIC_TABLES.includes(single)) {
        return new Response(JSON.stringify({ error: `Unknown table: ${single}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rows = await fetchAllRows(admin, single);
      return new Response(JSON.stringify(rows), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${single}.json"`,
        },
      });
    }

    // Multi-table mode: ?tables=a,b,c (default = all)
    const tablesParam = url.searchParams.get("tables");
    const requested = tablesParam
      ? tablesParam.split(",").map((t) => t.trim()).filter(Boolean)
      : PUBLIC_TABLES;
    const unknown = requested.filter((t) => !PUBLIC_TABLES.includes(t));
    if (unknown.length > 0) {
      return new Response(
        JSON.stringify({ error: `Unknown tables: ${unknown.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // deno-lint-ignore no-explicit-any
    const tables: Record<string, any[]> = {};
    const counts: Record<string, number> = {};
    for (const t of requested) {
      const rows = await fetchAllRows(admin, t);
      if (rows.length === 0) continue; // skip empty tables
      tables[t] = rows;
      counts[t] = rows.length;
    }

    const body = {
      exported_at: new Date().toISOString(),
      total_rows: Object.values(counts).reduce((a, b) => a + b, 0),
      counts,
      tables,
    };

    return new Response(JSON.stringify(body), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="db-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error("export-db-direct error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
