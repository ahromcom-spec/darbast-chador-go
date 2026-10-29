// Edge Function: admin-customer-order
// ثبت سفارش برای مشتری از سمت مدیریت (بدون ورود به حساب مشتری)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODULE_KEY = "customer_order_entry";
const ALLOWED_ROLES = [
  "ceo",
  "admin",
  "general_manager",
  "sales_manager",
  "operations_manager",
  "executive_manager",
  "scaffold_executive_manager",
  "rental_executive_manager",
  "executive_manager_scaffold_execution_with_materials",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toEnDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const normalizePhone = (raw: string) => {
  let p = toEnDigits(String(raw || "")).replace(/\D/g, "");
  if (p.startsWith("98") && p.length === 12) p = "0" + p.slice(2);
  if (p.startsWith("9") && p.length === 10) p = "0" + p;
  return p;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthenticated" }, 401);
    const caller = userData.user;

    const admin = createClient(supabaseUrl, serviceKey);

    // --- بررسی دسترسی: نقش مدیریتی یا تخصیص ماژول ---
    const [{ data: roles }, { data: assignments }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", caller.id),
      admin
        .from("module_assignments")
        .select("id")
        .eq("module_key", MODULE_KEY)
        .eq("is_active", true)
        .eq("assigned_user_id", caller.id),
    ]);
    const hasRole = (roles || []).some((r: any) => ALLOWED_ROLES.includes(r.role));
    const isAssigned = (assignments || []).length > 0;
    if (!hasRole && !isAssigned) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const action = body?.action as string;

    // ---------- جستجوی مشتری + آدرس‌ها + سفارش‌ها ----------
    if (action === "lookup") {
      const phone = normalizePhone(body.phone || "");
      if (phone.length < 10) return json({ error: "invalid_phone" }, 400);

      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, full_name, phone_number, customer_code, cooperation_rank")
        .eq("phone_number", phone)
        .limit(1);

      const profile = (profiles || [])[0] || null;
      if (!profile) return json({ found: false, phone });

      const [{ data: locations }, { data: customerRows }] = await Promise.all([
        admin
          .from("locations")
          .select("id, title, address_line, lat, lng, province_id, district_id, is_active, created_at, provinces(name), districts(name)")
          .eq("user_id", profile.user_id)
          .order("created_at", { ascending: false }),
        admin.from("customers").select("id").eq("user_id", profile.user_id),
      ]);

      const customerIds = (customerRows || []).map((c: any) => c.id);
      let orders: any[] = [];
      if (customerIds.length > 0) {
        const { data } = await admin
          .from("projects_v3")
          .select(
            "id, code, status, execution_stage, address, detailed_address, total_price, total_paid, payment_amount, created_at, is_archived, subcategory_id, subcategories(name, code, service_types_v3(name))",
          )
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .limit(200);
        orders = data || [];
      }

      return json({ found: true, profile, locations: locations || [], orders, customer_ids: customerIds });
    }

    // ---------- ثبت سفارش برای مشتری ----------
    if (action === "create") {
      let targetUserId = body.user_id as string;
      let subcategoryId = body.subcategory_id as string;
      // ثبت سفارش جدید از روی سفارش موجود (همان مشتری، نوع خدمت و آدرس)
      if (body.source_order_id) {
        const { data: src } = await admin
          .from("projects_v3")
          .select("customer_id, subcategory_id, hierarchy_project_id, address, detailed_address, province_id, district_id, location_lat, location_lng")
          .eq("id", body.source_order_id)
          .maybeSingle();
        if (!src) return json({ error: "source_order_not_found" }, 400);
        const { data: cust } = await admin.from("customers").select("user_id").eq("id", src.customer_id).maybeSingle();
        if (!cust?.user_id) return json({ error: "customer_not_found" }, 400);
        targetUserId = cust.user_id;
        subcategoryId = subcategoryId || src.subcategory_id;
        let srcLocationId: string | null = null;
        if (src.hierarchy_project_id) {
          const { data: hp } = await admin.from("projects_hierarchy").select("location_id").eq("id", src.hierarchy_project_id).maybeSingle();
          srcLocationId = hp?.location_id || null;
        }
        if (srcLocationId) {
          body.location_id = srcLocationId;
        } else {
          body.location_id = null;
          body.new_location = {
            title: src.detailed_address || null,
            address_line: src.address,
            province_id: src.province_id,
            district_id: src.district_id,
            lat: src.location_lat,
            lng: src.location_lng,
          };
        }
      }
      if (!targetUserId || !subcategoryId) return json({ error: "missing_fields" }, 400);

      const { data: sub } = await admin
        .from("subcategories")
        .select("id, name, code, service_type_id, service_types_v3(name)")
        .eq("id", subcategoryId)
        .maybeSingle();
      if (!sub) return json({ error: "subcategory_not_found" }, 400);
      const serviceTypeId = sub.service_type_id;

      // آدرس: موجود یا جدید
      let locationId = (body.location_id as string) || null;
      let address = "";
      let detailedAddress: string | null = null;
      let provinceId: string | null = null;
      let districtId: string | null = null;
      let lat: number | null = null;
      let lng: number | null = null;

      if (locationId) {
        const { data: loc } = await admin
          .from("locations")
          .select("id, user_id, title, address_line, province_id, district_id, lat, lng")
          .eq("id", locationId)
          .maybeSingle();
        if (!loc || loc.user_id !== targetUserId) return json({ error: "location_not_found" }, 400);
        address = loc.address_line;
        detailedAddress = loc.title || null;
        provinceId = loc.province_id;
        districtId = loc.district_id;
        lat = loc.lat;
        lng = loc.lng;
      } else {
        const newLoc = body.new_location || {};
        address = String(newLoc.address_line || "").trim();
        if (!address) return json({ error: "address_required" }, 400);
        provinceId = newLoc.province_id || null;
        districtId = newLoc.district_id || null;
        lat = typeof newLoc.lat === "number" ? newLoc.lat : null;
        lng = typeof newLoc.lng === "number" ? newLoc.lng : null;
        detailedAddress = newLoc.title || null;

        const { data: created, error: locErr } = await admin
          .from("locations")
          .insert({
            user_id: targetUserId,
            title: newLoc.title || null,
            address_line: address,
            province_id: provinceId,
            district_id: districtId,
            lat: lat ?? 0,
            lng: lng ?? 0,
            is_active: true,
          })
          .select("id")
          .single();
        if (locErr || !created) return json({ error: "location_failed", detail: locErr?.message }, 500);
        locationId = created.id;
      }

      // پروژه سلسله‌مراتبی
      const { data: hpId, error: hpErr } = await admin.rpc("get_or_create_project", {
        _user_id: targetUserId,
        _location_id: locationId,
        _service_type_id: serviceTypeId,
        _subcategory_id: subcategoryId,
      });
      if (hpErr) return json({ error: "hierarchy_failed", detail: hpErr.message }, 500);

      // رکورد مشتری
      let customerRowId: string | null = null;
      const { data: existingCustomer } = await admin
        .from("customers")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (existingCustomer?.id) {
        customerRowId = existingCustomer.id;
      } else {
        const { data: createdCustomer, error: custErr } = await admin
          .from("customers")
          .insert({ user_id: targetUserId })
          .select("id")
          .single();
        if (custErr || !createdCustomer) return json({ error: "customer_failed", detail: custErr?.message }, 500);
        customerRowId = createdCustomer.id;
      }

      const { data: targetProfile } = await admin
        .from("profiles")
        .select("full_name, phone_number")
        .eq("user_id", targetUserId)
        .maybeSingle();

      const price = Number(body.price) > 0 ? Number(body.price) : null;
      const notesPayload = {
        source: "admin_customer_order_entry",
        created_by_admin: true,
        admin_user_id: caller.id,
        service_type: (sub as any).service_types_v3?.name || null,
        subcategory: sub.name,
        service_label: `${(sub as any).service_types_v3?.name || ""} - ${sub.name}`.trim(),
        description: body.description || "",
        dimensions: Array.isArray(body.dimensions) ? body.dimensions : [],
        duration_months: Number(body.duration_months) > 0 ? Number(body.duration_months) : 1,
        total_price: price,
        estimated_price: price,
        additional_notes: body.description || "",
        customerName: targetProfile?.full_name || "",
        phoneNumber: targetProfile?.phone_number || "",
      };

      const { data: createdRows, error: createErr } = await admin.rpc("create_project_v3", {
        _customer_id: customerRowId,
        _province_id: provinceId,
        _district_id: districtId,
        _subcategory_id: subcategoryId,
        _hierarchy_project_id: hpId as string,
        _address: address,
        _detailed_address: detailedAddress,
        _location_lat: lat ?? undefined,
        _location_lng: lng ?? undefined,
        _notes: notesPayload as any,
      });
      if (createErr) return json({ error: "create_failed", detail: createErr.message }, 500);

      const project = Array.isArray(createdRows) ? createdRows[0] : createdRows;
      if (!project?.id) return json({ error: "create_empty" }, 500);

      if (price || lat || lng) {
        await admin
          .from("projects_v3")
          .update({
            ...(price ? { total_price: price, payment_amount: price } : {}),
            ...(lat ? { location_lat: lat } : {}),
            ...(lng ? { location_lng: lng } : {}),
          })
          .eq("id", project.id);
      }

      return json({ success: true, project_id: project.id, order_code: project.code });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("admin-customer-order fatal:", e);
    return json({ error: "internal", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
