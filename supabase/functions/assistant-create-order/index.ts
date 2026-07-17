// Edge Function: assistant-create-order
// ثبت نهایی سفارش از طریق گفتگو با دستیار اهرم
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QOM_PROVINCE_ID = "d2243423-4825-4c21-96ed-0ef95d193f7d";

interface DraftPayload {
  draft_id?: string;
  service_type_id?: string | null;
  subcategory_id?: string | null;
  subcategory_code?: string | null;
  service_label?: string | null;
  dimensions?: Array<{ length?: number; width?: number; height?: number }>;
  defaults?: Record<string, unknown>;
  address?: string | null;
  province_id?: string | null;
  district_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  media_paths?: string[];
  calculated_price?: number | null;
  duration_months?: number | null;
  notes_extra?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // کاربر authenticated
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // service role برای bypass در عملیات‌های امن
    const admin = createClient(supabaseUrl, serviceKey);

    const body = (await req.json().catch(() => ({}))) as DraftPayload;

    // 1) شناسایی service_type و subcategory
    let serviceTypeId = body.service_type_id ?? null;
    let subcategoryId = body.subcategory_id ?? null;

    if (!subcategoryId && body.subcategory_code && serviceTypeId) {
      const { data: sc } = await admin
        .from("subcategories")
        .select("id")
        .eq("service_type_id", serviceTypeId)
        .eq("code", body.subcategory_code)
        .maybeSingle();
      if (sc) subcategoryId = sc.id;
    }

    // پیش‌فرض: اگر serviceType موجود است ولی subcategory نیست، زیرشاخه «با مصالح» (کد 10)
    if (!subcategoryId && serviceTypeId) {
      const { data: sc } = await admin
        .from("subcategories")
        .select("id")
        .eq("service_type_id", serviceTypeId)
        .eq("code", "10")
        .maybeSingle();
      if (sc) subcategoryId = sc.id;
    }

    // اگر هیچ‌کدام نیست، پیش‌فرض = داربست فلزی نما با مصالح
    if (!subcategoryId) {
      const { data: defaultSt } = await admin
        .from("service_types_v3")
        .select("id")
        .ilike("name", "%داربست%")
        .limit(1)
        .maybeSingle();
      if (defaultSt) {
        serviceTypeId = defaultSt.id;
        const { data: sc } = await admin
          .from("subcategories")
          .select("id")
          .eq("service_type_id", defaultSt.id)
          .eq("code", "10")
          .maybeSingle();
        if (sc) subcategoryId = sc.id;
      }
    }

    if (!subcategoryId) {
      return new Response(JSON.stringify({ error: "subcategory_not_found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!serviceTypeId && subcategoryId) {
      const { data: sub } = await admin
        .from("subcategories")
        .select("service_type_id")
        .eq("id", subcategoryId)
        .maybeSingle();
      serviceTypeId = sub?.service_type_id || null;
    }

    // 2) Location (lat/lng اختیاری)
    const address = (body.address || "آدرس بعداً تکمیل می‌شود").trim();
    const provinceId = body.province_id || QOM_PROVINCE_ID;
    const districtId = body.district_id || null;
    const lat = typeof body.lat === "number" ? body.lat : 0;
    const lng = typeof body.lng === "number" ? body.lng : 0;

    const { data: newLocation, error: locErr } = await admin
      .from("locations")
      .insert({
        user_id: user.id,
        province_id: provinceId,
        district_id: districtId,
        address_line: address,
        lat,
        lng,
        is_active: true,
      })
      .select("id")
      .single();
    if (locErr || !newLocation) {
      console.error("location insert error:", locErr);
      return new Response(JSON.stringify({ error: "location_failed", detail: locErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) سلسله‌مراتب پروژه
    let hierarchyProjectId: string | null = null;
    if (serviceTypeId) {
      const { data: hpId } = await admin.rpc("get_or_create_project", {
        _user_id: user.id,
        _location_id: newLocation.id,
        _service_type_id: serviceTypeId,
        _subcategory_id: subcategoryId,
      });
      hierarchyProjectId = (hpId as string) || null;
    }

    // 4) ایجاد سفارش projects_v3 از طریق RPC
    // resolve customers.id for this auth user (find or create)
    let customerRowId: string | null = null;
    {
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.id) {
        customerRowId = existing.id;
      } else {
        const { data: created, error: createCustErr } = await admin
          .from("customers")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (createCustErr || !created) {
          console.error("customer create error:", createCustErr);
          return new Response(JSON.stringify({ error: "customer_failed", detail: createCustErr?.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        customerRowId = created.id;
      }
    }

    const notesPayload = {
      source: "ahrom_assistant",
      assistant_draft: true,
      dimensions: body.dimensions || [],
      defaults: body.defaults || {},
      duration_months: body.duration_months || 1,
      estimated_price: body.calculated_price || 0,
      service_label: body.service_label || null,
      customerName: (user.user_metadata as any)?.full_name || "",
      phoneNumber: user.phone || (user.user_metadata as any)?.phone_number || "",
      ...(body.notes_extra || {}),
    };

    const { data: createdRows, error: createErr } = await admin.rpc("create_project_v3", {
      _customer_id: customerRowId,
      _province_id: provinceId,
      _district_id: districtId,
      _subcategory_id: subcategoryId,
      _hierarchy_project_id: hierarchyProjectId,
      _address: address,
      _detailed_address: address,
      _notes: notesPayload as any,
    });

    if (createErr) {
      console.error("create_project_v3 error:", createErr);
      return new Response(JSON.stringify({ error: "create_failed", detail: createErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const project = Array.isArray(createdRows) ? createdRows[0] : createdRows;
    if (!project?.id) {
      return new Response(JSON.stringify({ error: "create_empty" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) به‌روزرسانی قیمت‌ها و مختصات روی پروژه ایجاد شده
    if (body.calculated_price || lat || lng) {
      await admin
        .from("projects_v3")
        .update({
          ...(body.calculated_price ? { payment_amount: body.calculated_price, total_price: body.calculated_price } : {}),
          ...(lat ? { location_lat: lat } : {}),
          ...(lng ? { location_lng: lng } : {}),
        })
        .eq("id", project.id);
    }

    // 6) لینک media_paths (اگر کاربر قبلاً در storage آپلود کرده باشد)
    if (Array.isArray(body.media_paths) && body.media_paths.length > 0) {
      const rows = body.media_paths.map((p) => ({
        project_id: project.id,
        user_id: user.id,
        file_path: p,
        file_type: /\.(mp4|mov|webm|m4v|avi)$/i.test(p) ? "video" : "image",
        file_size: 0,
        mime_type: /\.(mp4|mov|webm|m4v|avi)$/i.test(p) ? "video/mp4" : "image/jpeg",
      }));
      await admin.from("project_media").insert(rows);
    }

    // 7) ثبت draft نهایی
    await admin.from("assistant_draft_orders").insert({
      user_id: user.id,
      service_type_id: serviceTypeId,
      subcategory_id: subcategoryId,
      service_label: body.service_label || null,
      dimensions: body.dimensions || [],
      defaults: body.defaults || {},
      address,
      province_id: provinceId,
      district_id: districtId,
      lat: lat || null,
      lng: lng || null,
      media_paths: body.media_paths || [],
      calculated_price: body.calculated_price || null,
      status: "finalized",
      project_id: project.id,
      raw_payload: body as any,
    });

    return new Response(
      JSON.stringify({
        success: true,
        project_id: project.id,
        order_code: project.code,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("assistant-create-order fatal:", e);
    return new Response(
      JSON.stringify({ error: "internal", detail: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
