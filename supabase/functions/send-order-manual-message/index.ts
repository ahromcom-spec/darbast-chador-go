// پیام دستی مدیریت از کادر «ارسال پیام سفارشی» در جزئیات سفارش.
// مدیر متن را با المان‌های سفارش (مثل {code} یا {remainingAmount}) می‌نویسد و گیرندگان را
// (مشتری سفارش و/یا همکاران پذیرفته‌شده) انتخاب می‌کند؛ پیام از خط خدماتی ارسال پیامک سایت می‌رود.
// متن نهایی با همان سازنده پیام send-order-sms ساخته می‌شود تا پیش‌نمایش و ارسال یکی باشند.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { normalizeIranMobile } from "../_shared/smsCustomFrames.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  orderId: z.string().uuid(),
  message: z.string().trim().min(1, "متن پیام خالی است").max(700, "متن پیام حداکثر ۷۰۰ نویسه است"),
  customer: z.boolean().default(false),
  collaboratorIds: z.array(z.string().uuid()).max(30).default([]),
  preview: z.boolean().default(false),
  description: z.string().trim().max(1000).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Target { kind: "customer" | "collaborator"; id?: string; name: string; phone: string; optedOut: boolean }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "ابتدا وارد حساب مدیریت شوید" }, 401);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: "ابتدا وارد حساب مدیریت شوید" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: isManager } = await admin.rpc("is_order_message_manager", { _user_id: userData.user.id });
  if (isManager !== true) return json({ error: "فقط مدیران سفارش می‌توانند پیام سفارشی بفرستند" }, 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message || "درخواست نامعتبر است";
    return json({ error: first }, 400);
  }
  const { orderId, message, customer, collaboratorIds, preview, description } = parsed.data;
  if (!preview && !customer && collaboratorIds.length === 0) return json({ error: "حداقل یک گیرنده انتخاب کنید" }, 400);

  // === سفارش و مشتری ===
  const { data: o } = await admin.from("projects_v3")
    .select("id, code, subcategory_id, customer_id, customer_name, customer_phone, address, detailed_address, total_price, payment_amount")
    .eq("id", orderId).maybeSingle();
  if (!o) return json({ error: "سفارش پیدا نشد" }, 404);

  let customerPhone = normalizeIranMobile(o.customer_phone);
  let customerName: string = o.customer_name || "";
  let customerOptedOut = false;
  if (o.customer_id) {
    const { data: cust } = await admin.from("customers").select("user_id").eq("id", o.customer_id).maybeSingle();
    if (cust?.user_id) {
      const { data: prof } = await admin.from("profiles").select("full_name, phone_number, sms_notifications_enabled").eq("user_id", cust.user_id).maybeSingle();
      if (!customerPhone) customerPhone = normalizeIranMobile(prof?.phone_number);
      if (!customerName) customerName = prof?.full_name || "";
      if (prof?.sms_notifications_enabled === false && normalizeIranMobile(prof?.phone_number) === customerPhone) customerOptedOut = true;
    }
  }
  if (customerPhone && !customerOptedOut) {
    const { data: byPhone } = await admin.from("profiles").select("sms_notifications_enabled").eq("phone_number", customerPhone).maybeSingle();
    if (byPhone?.sms_notifications_enabled === false) customerOptedOut = true;
  }

  // === گیرندگان ===
  const targets: Target[] = [];
  if (customer) targets.push({ kind: "customer", name: customerName || "مشتری", phone: customerPhone, optedOut: customerOptedOut });
  if (collaboratorIds.length) {
    const { data: collabs } = await admin.from("order_collaborators")
      .select("id, invitee_user_id, invitee_phone_number, collaborator_name")
      .eq("order_id", o.id).eq("status", "accepted").in("id", collaboratorIds);
    const ids = (collabs || []).map((c: any) => c.invitee_user_id).filter(Boolean);
    const { data: profs } = ids.length ? await admin.from("profiles").select("user_id, full_name, phone_number, sms_notifications_enabled").in("user_id", ids) : { data: [] as any[] };
    const profByUser = new Map((profs || []).map((p: any) => [p.user_id, p]));
    for (const c of collabs || []) {
      const prof = profByUser.get((c as any).invitee_user_id) as any;
      targets.push({
        kind: "collaborator",
        id: (c as any).id,
        name: String((c as any).collaborator_name || prof?.full_name || "همکار").trim(),
        phone: normalizeIranMobile((c as any).invitee_phone_number || prof?.phone_number),
        optedOut: prof?.sms_notifications_enabled === false,
      });
    }
  }

  let serviceType: string | undefined;
  if (o.subcategory_id) {
    const { data: sub } = await admin.from("subcategories").select("name").eq("id", o.subcategory_id).maybeSingle();
    serviceType = sub?.name || undefined;
  }
  const address = [o.address, o.detailed_address].filter(Boolean).join(" - ") || undefined;
  const amount = [o.total_price, o.payment_amount].map(Number).find((v) => Number.isFinite(v) && v > 0);

  const callSender = async (phone: string, previewOnly: boolean) => {
    const res = await fetch(`${url}/functions/v1/send-order-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        phone, orderCode: o.code, orderId: o.id, status: "manual_message", manualTemplate: message,
        serviceType, address, amount, customerName: customerName || undefined, description,
        bypassWindow: true, previewOnly,
      }),
    });
    return await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  };

  // === پیش‌نمایش: متن نهایی بدون ارسال ===
  if (preview) {
    const samplePhone = targets.find((t) => t.phone)?.phone || customerPhone || "09120000000";
    const data = await callSender(samplePhone, true);
    if (typeof data?.previewMessage !== "string") return json({ error: data?.message || data?.error || "متن پیام ساخته نشد" }, 400);
    return json({ previewMessage: data.previewMessage });
  }

  // === ارسال ===
  const seen = new Set<string>();
  const results = await Promise.all(targets.map(async (t) => {
    const base = { kind: t.kind, id: t.id, name: t.name, phone: t.phone };
    if (!t.phone) return { ...base, status: "skipped", note: "شماره موبایل معتبر ندارد" };
    if (seen.has(t.phone)) return { ...base, status: "skipped", note: "همین شماره در گیرندگان تکرار شده است" };
    seen.add(t.phone);
    if (t.optedOut) return { ...base, status: "skipped", note: "پیامک‌ها را در حساب خود خاموش کرده است" };
    const data = await callSender(t.phone, false);
    if (data?.duplicate) return { ...base, status: "skipped", note: "همین متن در ۳۰ دقیقه گذشته برای این شماره رفته است" };
    if (data?.success === true && String(data?.message || "") === "پیامک با موفقیت ارسال شد") return { ...base, status: "sent" };
    if (data?.success === true) return { ...base, status: "skipped", note: String(data?.message || "ارسال نشد") };
    return { ...base, status: "failed", note: String(data?.error || data?.message || "ارسال ناموفق بود؛ سایت خودکار دوباره تلاش می‌کند") };
  }));

  console.log(`[send-order-manual-message] order ${o.code}: ${results.filter((r) => r.status === "sent").length}/${results.length} sent`);
  return json({ success: true, results });
});
