// ارسال «قاب‌های پیام سفارشی» برای یک رویداد مرحله سفارش.
// هر بار که مرحله‌ای از سفارش رخ می‌دهد، این تابع قاب‌های فعال همان مرحله و همان خدمت را پیدا می‌کند،
// گیرندگان هر قاب را مشخص می‌کند و هر پیام را از مسیر اصلی ارسال پیامک (send-order-sms) می‌فرستد.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  CUSTOM_FRAME_SCOPE, CUSTOM_FRAME_STAGE_KEYS, DISPATCH_DEDUPE_SECONDS, dispatchClaimKey, frameAppliesTo,
  frameKinds, normalizeIranMobile, resolveFrameRecipients, type CustomFrame,
} from "../_shared/smsCustomFrames.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const text = (max: number) => z.string().trim().max(max).optional();
const BodySchema = z.object({
  orderId: z.string().uuid().optional(),
  orderCode: z.string().trim().min(1).max(40).optional(),
  stage: z.enum(CUSTOM_FRAME_STAGE_KEYS as [string, ...string[]]),
  skipCustomer: z.boolean().optional(),
  source: z.string().max(20).optional(),
  details: z.object({
    serviceType: text(200),
    address: text(500),
    customerName: text(200),
    description: text(1000),
    amount: z.number().finite().nonnegative().optional(),
    paidAmount: z.number().finite().optional(),
    totalPaid: z.number().finite().optional(),
    remainingAmount: z.number().finite().optional(),
  }).partial().optional(),
}).refine((b) => !!b.orderId || !!b.orderCode, { message: "orderId or orderCode is required" });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const EdgeRuntime: { waitUntil(p: Promise<any>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { orderId, orderCode, stage, skipCustomer, details = {} } = parsed.data;

  // === تشخیص فراخوان ===
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const isService = !!token && token === serviceKey;
  // deno-lint-ignore no-explicit-any
  let userClient: any = null;
  if (!isService && token && token !== anonKey) {
    const c = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data } = await c.auth.getUser();
    if (data?.user) userClient = c;
  }

  // === سفارش ===
  const cols = "id, code, status, execution_stage, subcategory_id, customer_id, customer_name, customer_phone, address, detailed_address, total_price, payment_amount, billing_only";
  const base = admin.from("projects_v3").select(cols);
  const { data: order } = orderId ? await base.eq("id", orderId).maybeSingle() : await base.eq("code", orderCode!).limit(1).maybeSingle();
  if (!order) return json({ error: "order not found" }, 404);
  const o = order as Record<string, any>;

  if (!isService) {
    if (userClient) {
      // فقط کسی که به این سفارش دسترسی دارد می‌تواند رویداد آن را گزارش کند
      const { data: visible } = await userClient.from("projects_v3").select("id").eq("id", o.id).maybeSingle();
      if (!visible) return json({ error: "forbidden" }, 403);
    } else if (!(stage === "rejected" && o.status === "rejected")) {
      // رویداد بدون حساب کاربری فقط وقتی پذیرفته می‌شود که با وضعیت واقعی سفارش بخواند (رد سفارش از پایگاه داده)
      return json({ error: "unauthorized" }, 401);
    }
  }

  // === قاب‌های فعال همین مرحله و همین خدمت ===
  const { data: frameRows } = await admin
    .from("sms_templates")
    .select("id, key, scope, stage_key, enabled, service_subcategory_ids, excluded_subcategory_ids, recipient_kinds, recipient_roles, recipient_phones, conditions")
    .eq("scope", CUSTOM_FRAME_SCOPE)
    .eq("stage_key", stage)
    .eq("enabled", true);
  const frames = ((frameRows || []) as CustomFrame[]).filter((f) => frameAppliesTo(f, stage, o.subcategory_id));
  if (frames.length === 0) return json({ success: true, frames: 0, recipients: 0 });

  // === اطلاعات گیرندگان (فقط آنچه قاب‌ها لازم دارند) ===
  const needKinds = new Set(frames.flatMap(frameKinds));
  let customerPhone = normalizeIranMobile(o.customer_phone);
  let customerName: string | undefined = o.customer_name || undefined;
  let customerSmsDisabled = false;
  if (needKinds.has("customer") || !customerName) {
    if (o.customer_id) {
      const { data: cust } = await admin.from("customers").select("user_id").eq("id", o.customer_id).maybeSingle();
      if (cust?.user_id) {
        const { data: prof } = await admin.from("profiles").select("full_name, phone_number, sms_notifications_enabled").eq("user_id", cust.user_id).maybeSingle();
        if (!customerPhone) customerPhone = normalizeIranMobile(prof?.phone_number);
        if (!customerName) customerName = prof?.full_name || undefined;
        if (prof?.sms_notifications_enabled === false && normalizeIranMobile(prof?.phone_number) === customerPhone) customerSmsDisabled = true;
      }
    }
    if (customerPhone && !customerSmsDisabled) {
      const { data: byPhone } = await admin.from("profiles").select("sms_notifications_enabled").eq("phone_number", customerPhone).maybeSingle();
      if (byPhone?.sms_notifications_enabled === false) customerSmsDisabled = true;
    }
  }

  let collaboratorPhones: string[] = [];
  if (needKinds.has("collaborators")) {
    const { data: collabs } = await admin.from("order_collaborators").select("invitee_phone_number, invitee_user_id").eq("order_id", o.id).eq("status", "accepted");
    const ids = (collabs || []).map((c: any) => c.invitee_user_id).filter(Boolean);
    const { data: profs } = ids.length ? await admin.from("profiles").select("user_id, phone_number").in("user_id", ids) : { data: [] as any[] };
    const phoneByUser = new Map((profs || []).map((p: any) => [p.user_id, p.phone_number]));
    collaboratorPhones = (collabs || []).map((c: any) => c.invitee_phone_number || phoneByUser.get(c.invitee_user_id)).filter(Boolean);
  }

  const rolePhones: Record<string, string[]> = {};
  const roles = [...new Set(frames.filter((f) => frameKinds(f).includes("roles")).flatMap((f) => f.recipient_roles || []))];
  if (roles.length) {
    const { data: ur } = await admin.from("user_roles").select("user_id, role").in("role", roles);
    const ids = [...new Set((ur || []).map((r: any) => r.user_id))];
    const { data: profs } = ids.length ? await admin.from("profiles").select("user_id, phone_number").in("user_id", ids) : { data: [] as any[] };
    const phoneByUser = new Map((profs || []).map((p: any) => [p.user_id, p.phone_number]));
    for (const r of ur || []) {
      const p = phoneByUser.get((r as any).user_id);
      if (p) (rolePhones[(r as any).role] ||= []).push(p);
    }
  }

  // === ساخت فهرست ارسال با جلوگیری از تکرار ===
  const address = details.address || [o.address, o.detailed_address].filter(Boolean).join(" - ") || undefined;
  let serviceType = details.serviceType;
  if (!serviceType && o.subcategory_id) {
    const { data: sub } = await admin.from("subcategories").select("name").eq("id", o.subcategory_id).maybeSingle();
    serviceType = sub?.name || undefined;
  }
  const amountCandidates = [details.amount, o.total_price, o.payment_amount].map(Number).filter((v) => Number.isFinite(v) && v > 0);

  const jobs: Array<Record<string, unknown>> = [];
  for (const f of frames) {
    const recipients = resolveFrameRecipients(f, { customerPhone, customerSmsDisabled, skipCustomer, collaboratorPhones, rolePhones });
    for (const r of recipients) {
      const { data: claimed } = await admin.rpc("claim_sms_dispatch", {
        _key: dispatchClaimKey(o.id, stage, f.key, r.phone),
        _window_seconds: DISPATCH_DEDUPE_SECONDS,
      });
      if (claimed !== true) continue;
      jobs.push({
        phone: r.phone,
        orderCode: o.code,
        orderId: o.id,
        status: stage,
        templateKey: f.key,
        audience: r.audience,
        serviceType,
        address,
        customerName: details.customerName || customerName,
        description: details.description,
        amount: amountCandidates[0],
        paidAmount: details.paidAmount,
        totalPaid: details.totalPaid,
        remainingAmount: details.remainingAmount,
        bypassWindow: (f.conditions as any)?.respectWindow === false,
      });
    }
  }

  const sendAll = Promise.allSettled(jobs.map((body) =>
    fetch(`${url}/functions/v1/send-order-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(body),
    }).then((r) => r.text()).catch((e) => console.error("[dispatch-order-messages] send failed", e))
  ));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(sendAll);
  else await sendAll;

  console.log(`[dispatch-order-messages] order ${o.code} stage ${stage}: ${frames.length} frame(s), ${jobs.length} message(s)`);
  return json({ success: true, frames: frames.length, recipients: jobs.length });
});
