// Export-database edge function
// Exports all public tables + auth.users + auth.identities as a single ZIP
// Only callable by users with the `ceo` or `general_manager` role.
//
// Returns: application/zip (binary)
//
// Tables are streamed in 1000-row pages to avoid the PostgREST default cap and
// to keep memory bounded for large tables (e.g. site_analytics with 70k+ rows).

import { createClient } from "npm:@supabase/supabase-js@2";
// deno-lint-ignore-file no-explicit-any
import { BlobWriter, TextReader, ZipWriter } from "npm:@zip.js/zip.js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Public tables to export — kept in alphabetical order.
// Empty tables are still queried but skipped from the ZIP if they return zero rows.
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

async function fetchAllRows(admin: any, table: string): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      // Table may not exist or be inaccessible — skip silently.
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

async function fetchAuthUsers(): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
      },
    );
    if (!res.ok) {
      console.warn(`auth users fetch failed: ${res.status}`);
      break;
    }
    const json = await res.json();
    const users = json.users ?? [];
    if (users.length === 0) break;
    all.push(...users);
    if (users.length < 200) break;
    page++;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is a CEO or general_manager
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r: any) =>
      ["ceo", "general_manager", "admin"].includes(r.role),
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build ZIP in memory
    const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
    const manifest: Record<string, number> = {};

    for (const table of PUBLIC_TABLES) {
      const rows = await fetchAllRows(admin, table);
      if (rows.length === 0) continue;
      manifest[`public/${table}.json`] = rows.length;
      await zipWriter.add(
        `public/${table}.json`,
        new TextReader(JSON.stringify(rows, null, 2)),
      );
    }

    // Auth users
    const users = await fetchAuthUsers();
    if (users.length > 0) {
      manifest["auth/users.json"] = users.length;
      await zipWriter.add(
        "auth/users.json",
        new TextReader(JSON.stringify(users, null, 2)),
      );
      // identities are embedded inside each user record returned by GoTrue admin API
      const identities = users.flatMap((u: any) => u.identities ?? []);
      if (identities.length > 0) {
        manifest["auth/identities.json"] = identities.length;
        await zipWriter.add(
          "auth/identities.json",
          new TextReader(JSON.stringify(identities, null, 2)),
        );
      }
    }

    // Manifest with row counts + export timestamp
    await zipWriter.add(
      "MANIFEST.json",
      new TextReader(
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            counts: manifest,
            total_rows: Object.values(manifest).reduce((a, b) => a + b, 0),
          },
          null,
          2,
        ),
      ),
    );

    const blob = await zipWriter.close();
    const buf = new Uint8Array(await blob.arrayBuffer());
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="ahrom-db-export-${stamp}.zip"`,
      },
    });
  } catch (err) {
    console.error("export error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
