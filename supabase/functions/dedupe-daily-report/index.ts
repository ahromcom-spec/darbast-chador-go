import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANAGER_ROLES = new Set([
  'admin',
  'ceo',
  'general_manager',
  'scaffold_executive_manager',
  'executive_manager_scaffold_execution_with_materials',
]);

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normStr(v: unknown) {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

function normNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normBool(v: unknown) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function staffKey(row: any) {
  // Duplicate definition must match the UI's notion of “exact same row”
  return JSON.stringify([
    normStr(row.staff_user_id),
    normStr(row.staff_name),
    normStr(row.work_status),
    normNum(row.overtime_hours),
    normNum(row.amount_received),
    normStr(row.receiving_notes),
    normNum(row.amount_spent),
    normStr(row.spending_notes),
    normBool(row.is_cash_box),
    normBool(row.is_company_expense),
    normStr(row.bank_card_id),
    normStr(row.notes),
  ]);
}

function orderKey(row: any) {
  return JSON.stringify([
    normStr(row.order_id),
    normStr(row.team_name),
    normStr(row.service_details),
    normStr(row.activity_description),
    normStr(row.notes),
    normStr(row.row_color),
  ]);
}

async function fetchAll<T>(supabase: any, table: string, select: string, match: Record<string, any>): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    for (const [k, v] of Object.entries(match)) {
      q = q.eq(k, v);
    }

    const { data, error } = await q;
    if (error) throw error;

    const chunk = (data || []) as T[];
    out.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

async function deleteInBatches(supabase: any, table: string, ids: string[]) {
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const body = await req.json().catch(() => ({}));
    const report_date = normStr(body?.report_date);
    const module_key = normStr(body?.module_key);

    if (!report_date || !/^\d{4}-\d{2}-\d{2}$/.test(report_date)) {
      return jsonResponse(400, { error: 'report_date is required (YYYY-MM-DD)' });
    }
    if (!module_key) {
      return jsonResponse(400, { error: 'module_key is required' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Server misconfigured' });
    }

    // Service role client (bypasses RLS) but we still authorize caller via JWT.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const userId = userData.user.id;
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (rolesError) throw rolesError;

    const isManager = (roles || []).some((r: any) => MANAGER_ROLES.has(r.role));
    if (!isManager) {
      return jsonResponse(403, { error: 'Forbidden' });
    }

    const { data: reports, error: reportsError } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('report_date', report_date)
      .eq('module_key', module_key);

    if (reportsError) throw reportsError;

    const reportIds = (reports || []).map((r: any) => r.id).filter(Boolean);

    let staffDeleted = 0;
    let ordersDeleted = 0;

    for (const reportId of reportIds) {
      // Staff
      const staffRows = await fetchAll<any>(
        supabase,
        'daily_report_staff',
        'id, staff_user_id, staff_name, work_status, overtime_hours, amount_received, receiving_notes, amount_spent, spending_notes, is_cash_box, is_company_expense, bank_card_id, notes, created_at',
        { daily_report_id: reportId }
      );

      const seenStaff = new Set<string>();
      const staffDeleteIds: string[] = [];

      for (const row of staffRows) {
        const key = staffKey(row);
        if (seenStaff.has(key)) {
          staffDeleteIds.push(row.id);
        } else {
          seenStaff.add(key);
        }
      }

      if (staffDeleteIds.length > 0) {
        await deleteInBatches(supabase, 'daily_report_staff', staffDeleteIds);
        staffDeleted += staffDeleteIds.length;
      }

      // Orders
      const orderRows = await fetchAll<any>(
        supabase,
        'daily_report_orders',
        'id, order_id, team_name, service_details, activity_description, notes, row_color, created_at',
        { daily_report_id: reportId }
      );

      const seenOrders = new Set<string>();
      const orderDeleteIds: string[] = [];

      for (const row of orderRows) {
        const key = orderKey(row);
        if (seenOrders.has(key)) {
          orderDeleteIds.push(row.id);
        } else {
          seenOrders.add(key);
        }
      }

      if (orderDeleteIds.length > 0) {
        await deleteInBatches(supabase, 'daily_report_orders', orderDeleteIds);
        ordersDeleted += orderDeleteIds.length;
      }
    }

    return jsonResponse(200, {
      success: true,
      report_date,
      module_key,
      reports_count: reportIds.length,
      staff_deleted: staffDeleted,
      orders_deleted: ordersDeleted,
    });
  } catch (error: any) {
    console.error('dedupe-daily-report error:', error);
    return jsonResponse(500, { error: error?.message ?? 'Unknown error' });
  }
});
