// ارسال «قاب‌های پیام سفارشی» برای یک رویداد مرحله سفارش.
// هر بار که مرحله‌ای از سفارش رخ می‌دهد، این تابع قاب‌های فعال همان مرحله و همان خدمت را پیدا می‌کند،
// گیرندگان هر قاب را مشخص می‌کند و هر پیام را از مسیر اصلی ارسال پیامک (send-order-sms) می‌فرستد.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  CUSTOM_FRAME_SCOPE, CUSTOM_FRAME_STAGE_KEYS, DISPATCH_DEDUPE_SECONDS, dispatchClaimKey, frameAppliesTo,
  frameKinds, normalizeIranMobile, resolveFrameRecipients, type CustomFrame,
} from "../_shared/smsCustomFrames.ts";
import {
  EVENT_DEDUPE_SECONDS, ORDER_EVENT_TABLES, eventMoney, eventStageFor, isRecentEvent, jalaliDate, renewalMonthLabel,
  type OrderEventTable,
} from "../_shared/smsOrderEvents.ts";
import {
  STATEMENT_EVENT_STAGE, formatAllocation, paymentMethodLabel, statementSummary, type StatementEventKind,
} from "../_shared/smsStatementEvents.ts";
import {
  COLLABORATOR_COPY_FRAME_KEY, enabledCollaboratorPhones, isCollaboratorCopyStage,
} from "../_shared/collaboratorSms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const text = (max: number) => z.string().trim().max(max).optional();
const EventSchema = z.object({
  table: z.enum(ORDER_EVENT_TABLES as unknown as [OrderEventTable, ...OrderEventTable[]]),
  id: z.string().uuid(),
  op: z.enum(["INSERT", "UPDATE"]),
  oldStatus: z.string().max(40).nullable().optional(),
  newStatus: z.string().max(40).nullable().optional(),
});
const StatementEventSchema = z.object({
  kind: z.enum(["payment", "discount", "closed"]),
  // پرداخت: شناسه گروه پرداخت (STMT-GRP)؛ تخفیف/بستن: شناسه صورتحساب؛ تخفیف کلی: شناسه مشتری
  groupId: z.string().uuid().optional(),
  statementId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});
const BodySchema = z.object({
  orderId: z.string().uuid().optional(),
  orderCode: z.string().trim().min(1).max(40).optional(),
  stage: z.enum(CUSTOM_FRAME_STAGE_KEYS as [string, ...string[]]).optional(),
  // رویداد گزارش‌شده توسط پایگاه داده (تمدید، تعمیر، تخفیف، انتقال، همکار) — همیشه با داده واقعی سطر سنجیده می‌شود
  event: EventSchema.optional(),
  // رویداد صورتحساب گزارش‌شده توسط مدیر — همیشه با داده واقعی پایگاه داده سنجیده می‌شود
  statementEvent: StatementEventSchema.optional(),
  skipCustomer: z.boolean().optional(),
  // پیامک مشتری این سفارش خاموش است: فقط همکاران روشن (نسخه مرحله و قاب‌های «همکاران سفارش») پیام بگیرند
  collaboratorsOnly: z.boolean().optional(),
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
}).refine((b) => !!b.event || !!b.statementEvent || (!!b.stage && (!!b.orderId || !!b.orderCode)), { message: "event, or stage with orderId/orderCode, is required" });

// deno-lint-ignore no-explicit-any
type Admin = any;
interface ResolvedEvent {
  stage: string;
  orderId: string;
  eventRef: string;
  vars: Record<string, string>;
  personUserId?: string | null;
  personPhone?: string | null;
  personName?: string | null;
  /** در انتقال سفارش، «مشتری» همان مالک انتقال‌دهنده است */
  customerUserId?: string | null;
}

const profileOf = async (admin: Admin, userId?: string | null) => {
  if (!userId) return null;
  const { data } = await admin.from("profiles").select("full_name, phone_number, sms_notifications_enabled").eq("user_id", userId).maybeSingle();
  return data as { full_name?: string | null; phone_number?: string | null; sms_notifications_enabled?: boolean | null } | null;
};

/** رویداد را از روی سطر واقعی پایگاه داده بازسازی می‌کند؛ اگر با وضعیت فعلی نخواند یا قدیمی باشد، null. */
async function resolveEvent(admin: Admin, ev: z.infer<typeof EventSchema>): Promise<ResolvedEvent | { skip: string }> {
  const stage = eventStageFor(ev.table, ev.op, ev.oldStatus, ev.newStatus);
  if (!stage) return { skip: "no frame stage for this change" };
  const fresh = (...t: Array<string | null | undefined>) => isRecentEvent(t);

  if (ev.table === "projects_v3") {
    const { data: o } = await admin.from("projects_v3")
      .select("id, discount_amount, price_before_discount, discount_note, discount_at, total_price, billing_only").eq("id", ev.id).maybeSingle();
    if (!o || o.billing_only || !(Number(o.discount_amount) > 0)) return { skip: "no discount" };
    if (!fresh(o.discount_at)) return { skip: "stale event" };
    const before = Number(o.price_before_discount);
    const after = Number.isFinite(before) && before > 0 ? before - Number(o.discount_amount) : Number(o.total_price);
    return {
      stage, orderId: o.id, eventRef: `projects_v3:${o.id}:${o.discount_at}`,
      vars: {
        discountAmount: eventMoney(o.discount_amount),
        priceBeforeDiscount: Number.isFinite(before) && before > 0 ? eventMoney(before) : eventMoney(Number(o.total_price) + Number(o.discount_amount)),
        priceAfterDiscount: eventMoney(after),
        discountNote: String(o.discount_note || "").trim(),
      },
    };
  }

  if (ev.table === "order_renewals") {
    const { data: r } = await admin.from("order_renewals")
      .select("id, order_id, billing_order_id, status, renewal_number, new_start_date, new_end_date, renewal_price, rejection_reason, created_at, updated_at")
      .eq("id", ev.id).maybeSingle();
    if (!r || (r.status || "") !== (ev.newStatus || "")) return { skip: "event state mismatch" };
    if (!fresh(r.created_at, r.updated_at)) return { skip: "stale event" };
    return {
      stage, orderId: r.billing_order_id || r.order_id, eventRef: `order_renewals:${r.id}`,
      vars: {
        renewalMonth: renewalMonthLabel(r.renewal_number),
        renewalPrice: eventMoney(r.renewal_price),
        renewalStartDate: jalaliDate(r.new_start_date),
        renewalEndDate: jalaliDate(r.new_end_date),
        reason: String(r.rejection_reason || "").trim(),
      },
    };
  }

  if (ev.table === "repair_requests") {
    const { data: r } = await admin.from("repair_requests")
      .select("id, order_id, billing_order_id, status, description, estimated_cost, final_cost, request_date, created_at, updated_at")
      .eq("id", ev.id).maybeSingle();
    if (!r || (r.status || "") !== (ev.newStatus || "")) return { skip: "event state mismatch" };
    if (!fresh(r.created_at, r.updated_at)) return { skip: "stale event" };
    const cost = r.final_cost ?? r.estimated_cost;
    return {
      stage, orderId: r.billing_order_id || r.order_id, eventRef: `repair_requests:${r.id}`,
      vars: {
        repairCost: Number(cost) > 0 ? eventMoney(cost) : "",
        repairDescription: String(r.description || "").trim(),
        repairDate: jalaliDate(r.request_date || r.created_at),
      },
    };
  }

  if (ev.table === "order_transfer_requests") {
    const { data: t } = await admin.from("order_transfer_requests")
      .select("id, order_id, from_user_id, to_user_id, to_phone_number, status, manager_rejection_reason, recipient_rejection_reason, created_at, updated_at")
      .eq("id", ev.id).maybeSingle();
    if (!t || (t.status || "") !== (ev.newStatus || "")) return { skip: "event state mismatch" };
    if (!fresh(t.created_at, t.updated_at)) return { skip: "stale event" };
    const [from, to] = await Promise.all([profileOf(admin, t.from_user_id), profileOf(admin, t.to_user_id)]);
    const personPhone = normalizeIranMobile(t.to_phone_number) || normalizeIranMobile(to?.phone_number);
    return {
      stage, orderId: t.order_id, eventRef: `order_transfer_requests:${t.id}`,
      personUserId: t.to_user_id, personPhone, personName: to?.full_name, customerUserId: t.from_user_id,
      vars: {
        personName: String(to?.full_name || personPhone || "").trim(),
        personPhone: personPhone || "",
        ownerName: String(from?.full_name || "").trim(),
        reason: String(t.manager_rejection_reason || t.recipient_rejection_reason || "").trim(),
      },
    };
  }

  // order_collaborators
  const { data: c } = await admin.from("order_collaborators")
    .select("id, order_id, inviter_user_id, invitee_user_id, invitee_phone_number, collaborator_name, status, manager_rejection_reason, invited_at, created_at, updated_at")
    .eq("id", ev.id).maybeSingle();
  if (!c || (c.status || "") !== (ev.newStatus || "")) return { skip: "event state mismatch" };
  if (!fresh(c.created_at, c.updated_at, c.invited_at)) return { skip: "stale event" };
  const invitee = await profileOf(admin, c.invitee_user_id);
  const personPhone = normalizeIranMobile(c.invitee_phone_number) || normalizeIranMobile(invitee?.phone_number);
  return {
    stage, orderId: c.order_id, eventRef: `order_collaborators:${c.id}`,
    personUserId: c.invitee_user_id, personPhone, personName: invitee?.full_name || c.collaborator_name,
    vars: {
      personName: String(invitee?.full_name || c.collaborator_name || personPhone || "").trim(),
      personPhone: personPhone || "",
      reason: String(c.manager_rejection_reason || "").trim(),
    },
  };
}

const sumAmounts = (rows: Array<{ amount?: unknown }>) => rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);

/** مبلغ کل، پرداخت و مانده چند صورتحساب (با تخفیف‌های خودشان) */
async function statementsFinance(admin: Admin, statementIds: string[], extraDiscount = 0) {
  if (statementIds.length === 0) return null;
  const [{ data: sts }, { data: orders }] = await Promise.all([
    admin.from("customer_statements").select("id, statement_number, discount_amount, discount_note, customer_id").in("id", statementIds),
    admin.from("projects_v3").select("id, code, status, total_price, payment_amount, billing_only, discount_amount, statement_id, created_at")
      .in("statement_id", statementIds),
  ]);
  const ords = (orders || []).filter((o: any) => o.status !== "rejected");
  const ids = ords.map((o: any) => o.id);
  const { data: pays } = ids.length ? await admin.from("order_payments").select("amount").in("order_id", ids) : { data: [] };
  const discount = (sts || []).reduce((a: number, x: any) => a + (Number(x.discount_amount) || 0), 0) + extraDiscount;
  return { statements: sts || [], orders: ords, summary: statementSummary(ords, sumAmounts(pays || []), discount) };
}

/** رویداد صورتحساب را از داده واقعی بازسازی می‌کند؛ اگر تازه نباشد یا داده نخواند، skip. */
async function resolveStatementEvent(admin: Admin, ev: z.infer<typeof StatementEventSchema>): Promise<ResolvedEvent | { skip: string }> {
  const stage = STATEMENT_EVENT_STAGE[ev.kind as StatementEventKind];
  const customerUserOf = async (customerId?: string | null) => {
    if (!customerId) return null;
    const { data } = await admin.from("customers").select("user_id").eq("id", customerId).maybeSingle();
    return data?.user_id || null;
  };
  const money = (n: number) => eventMoney(n);
  const num = (n: unknown) => Number(n || 0).toLocaleString("fa-IR");

  if (ev.kind === "payment") {
    if (!ev.groupId) return { skip: "missing payment group" };
    const { data: pays } = await admin.from("order_payments")
      .select("id, order_id, amount, payment_method, payment_date, created_at")
      .ilike("notes", `%STMT-GRP:${ev.groupId}%`);
    if (!pays?.length) return { skip: "payment not found" };
    if (!isRecentEvent(pays.map((p: any) => p.created_at))) return { skip: "stale event" };
    const { data: ords } = await admin.from("projects_v3").select("id, code, statement_id, created_at").in("id", [...new Set(pays.map((p: any) => p.order_id))]);
    const orderById = new Map((ords || []).map((o: any) => [o.id, o]));
    const stIds = [...new Set((ords || []).map((o: any) => o.statement_id).filter(Boolean))] as string[];
    const fin = await statementsFinance(admin, stIds);
    const stNum = new Map((fin?.statements || []).map((x: any) => [x.id, x.statement_number]));
    const allocation = formatAllocation(pays.map((p: any) => {
      const o = orderById.get(p.order_id) as any;
      return { orderCode: String(o?.code || ""), statementNumber: stNum.get(o?.statement_id) ?? null, amount: Number(p.amount) || 0 };
    }));
    const customerId = (fin?.statements?.[0] as any)?.customer_id || null;
    const anchor = (ords || []).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] as any;
    const numbers = (fin?.statements || []).map((x: any) => num(x.statement_number));
    const first = pays[0] as any;
    return {
      stage, orderId: anchor.id, eventRef: `statement_payment:${ev.groupId}`,
      customerUserId: await customerUserOf(customerId),
      vars: {
        statementNumber: numbers.length > 1 ? `${numbers.join("، ")}` : (numbers[0] || ""),
        statementTotal: fin ? money(fin.summary.total) : "",
        statementPaid: fin ? money(fin.summary.paid) : "",
        statementRemaining: fin ? money(fin.summary.remaining) : "",
        statementDiscount: fin && fin.summary.discount > 0 ? money(fin.summary.discount) : "",
        statementPaymentAmount: money(sumAmounts(pays)),
        statementPaymentMethod: paymentMethodLabel(first.payment_method),
        statementDepositDate: jalaliDate(first.payment_date || first.created_at),
        statementAllocation: allocation,
        statementOrderCodes: [...new Set((ords || []).map((o: any) => o.code))].join("، "),
      },
    };
  }

  if (ev.kind === "discount" && !ev.statementId) {
    // تخفیف کلی مشتری
    if (!ev.customerId) return { skip: "missing customer" };
    const { data: g } = await admin.from("customer_global_discounts").select("id, discount_amount, discount_note, updated_at, created_at")
      .eq("customer_id", ev.customerId).maybeSingle();
    if (!g || !(Number(g.discount_amount) > 0)) return { skip: "no discount" };
    if (!isRecentEvent([g.updated_at, g.created_at])) return { skip: "stale event" };
    const { data: sts } = await admin.from("customer_statements").select("id").eq("customer_id", ev.customerId);
    const stIds = (sts || []).map((x: any) => x.id);
    const fin = await statementsFinance(admin, stIds, Number(g.discount_amount) || 0);
    const anchor = (fin?.orders || []).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] as any;
    if (!anchor) return { skip: "customer has no orders" };
    return {
      stage, orderId: anchor.id, eventRef: `customer_global_discounts:${g.id}:${Math.round(Number(g.discount_amount))}`,
      customerUserId: await customerUserOf(ev.customerId),
      vars: {
        statementNumber: "همه صورتحساب‌ها",
        statementTotal: money(fin!.summary.total),
        statementPaid: money(fin!.summary.paid),
        statementRemaining: money(fin!.summary.remaining),
        statementDiscount: money(Number(g.discount_amount)),
        statementDiscountNote: String(g.discount_note || "").trim(),
        statementOrderCodes: fin!.orders.map((o: any) => o.code).join("، "),
      },
    };
  }

  if (!ev.statementId) return { skip: "missing statement" };
  const { data: st } = await admin.from("customer_statements")
    .select("id, customer_id, statement_number, status, closed_at, discount_amount, discount_note, updated_at").eq("id", ev.statementId).maybeSingle();
  if (!st) return { skip: "statement not found" };
  if (ev.kind === "closed") {
    if (st.status !== "closed" || !isRecentEvent([st.closed_at])) return { skip: "stale event" };
  } else {
    if (!(Number(st.discount_amount) > 0)) return { skip: "no discount" };
    if (!isRecentEvent([st.updated_at])) return { skip: "stale event" };
  }
  const fin = await statementsFinance(admin, [st.id]);
  const anchor = (fin?.orders || []).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] as any;
  if (!anchor) return { skip: "statement has no orders" };
  return {
    stage, orderId: anchor.id,
    eventRef: ev.kind === "closed" ? `customer_statements:${st.id}:closed` : `customer_statements:${st.id}:disc-${Math.round(Number(st.discount_amount))}`,
    customerUserId: await customerUserOf(st.customer_id),
    vars: {
      statementNumber: num(st.statement_number),
      statementTotal: money(fin!.summary.total),
      statementPaid: money(fin!.summary.paid),
      statementRemaining: money(fin!.summary.remaining),
      statementDiscount: Number(st.discount_amount) > 0 ? money(Number(st.discount_amount)) : "",
      statementDiscountNote: String(st.discount_note || "").trim(),
      statementOrderCodes: fin!.orders.map((o: any) => o.code).join("، "),
      statementClosedDate: st.closed_at ? jalaliDate(st.closed_at) : "",
    },
  };
}

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
  const { orderCode, details = {}, event, statementEvent } = parsed.data;
  const collaboratorsOnly = parsed.data.collaboratorsOnly === true;
  const skipCustomer = parsed.data.skipCustomer === true || collaboratorsOnly;
  let { orderId, stage } = parsed.data;

  // === تشخیص فراخوان ===
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const isService = !!token && token === serviceKey;
  // deno-lint-ignore no-explicit-any
  let userClient: any = null;
  let callerUserId: string | null = null;
  if (!isService && token && token !== anonKey) {
    const c = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data } = await c.auth.getUser();
    if (data?.user) { userClient = c; callerUserId = data.user.id; }
  }

  // === رویداد پایگاه داده: مرحله، سفارش و متغیرها فقط از داده واقعی سطر ساخته می‌شوند ===
  let resolvedEvent: ResolvedEvent | null = null;
  if (event) {
    const r = await resolveEvent(admin, event);
    if ("skip" in r) return json({ success: true, skipped: r.skip, frames: 0, recipients: 0 });
    resolvedEvent = r;
    stage = r.stage;
    orderId = r.orderId;
  }
  if (statementEvent && !event) {
    // فقط مدیران سفارش/مالی می‌توانند رویداد صورتحساب را گزارش کنند
    if (!isService) {
      if (!callerUserId) return json({ error: "unauthorized" }, 401);
      const { data: isManager } = await admin.rpc("is_order_message_manager", { _user_id: callerUserId });
      let allowed = isManager === true;
      if (!allowed) {
        const { data: fin } = await admin.from("user_roles").select("role").eq("user_id", callerUserId).eq("role", "finance_manager").limit(1);
        allowed = (fin || []).length > 0;
      }
      if (!allowed) return json({ error: "forbidden" }, 403);
    }
    const r = await resolveStatementEvent(admin, statementEvent);
    if ("skip" in r) return json({ success: true, skipped: r.skip, frames: 0, recipients: 0 });
    resolvedEvent = r;
    stage = r.stage;
    orderId = r.orderId;
  }
  if (!stage) return json({ error: "stage is required" }, 400);
  const statementStage = !!statementEvent && !event;

  // === سفارش ===
  const cols = "id, code, status, execution_stage, subcategory_id, customer_id, customer_name, customer_phone, address, detailed_address, total_price, payment_amount, billing_only";
  const base = admin.from("projects_v3").select(cols);
  const { data: order } = orderId ? await base.eq("id", orderId).maybeSingle() : await base.eq("code", orderCode!).limit(1).maybeSingle();
  if (!order) return json({ error: "order not found" }, 404);
  const o = order as Record<string, any>;

  if (!isService && !resolvedEvent) {
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
  const frames = ((frameRows || []) as CustomFrame[]).filter((f) => frameAppliesTo(f, stage!, statementStage ? null : o.subcategory_id));

  // نسخه پیام مرحله برای همکاران روشن: فقط تغییر مرحله اصلی سفارش و فقط وقتی سرور یا یکی از مدیران سفارش آن را گزارش کرده
  let copyAllowed = !resolvedEvent && isCollaboratorCopyStage(stage);
  if (copyAllowed && !isService) {
    if (!callerUserId) copyAllowed = false;
    else {
      const { data: isManager } = await admin.rpc("is_order_message_manager", { _user_id: callerUserId });
      if (isManager === true) copyAllowed = true;
      else {
        // کاربر دارای دسترسی سفارش (مثلاً مشتری پس از پرداخت آنلاین یا ثبت درخواست جمع‌آوری):
        // فقط وقتی پذیرفته می‌شود که همان رویداد واقعاً در چند دقیقه اخیر برای این سفارش ثبت شده باشد
        const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        let verified = false;
        if (stage === "paid") {
          const { data: pay } = await admin.from("order_payments").select("id").eq("order_id", o.id).gte("created_at", since).limit(1);
          verified = (pay || []).length > 0;
        } else if (stage === "awaiting_collection") {
          const { data: cr } = await admin.from("collection_requests").select("id").eq("order_id", o.id).gte("created_at", since).limit(1);
          verified = (cr || []).length > 0;
        }
        copyAllowed = verified;
      }
    }
  }
  if (frames.length === 0 && !copyAllowed) return json({ success: true, frames: 0, recipients: 0 });

  // === اطلاعات گیرندگان (فقط آنچه قاب‌ها لازم دارند) ===
  const needKinds = new Set(frames.flatMap(frameKinds));
  let customerPhone = normalizeIranMobile(o.customer_phone);
  let customerName: string | undefined = o.customer_name || undefined;
  let customerSmsDisabled = false;
  if (resolvedEvent?.customerUserId) {
    // انتقال سفارش: «مشتری» همان مالکی است که سفارش را منتقل می‌کند (حتی اگر سفارش به نام گیرنده شده باشد)
    const prof = await profileOf(admin, resolvedEvent.customerUserId);
    const p = normalizeIranMobile(prof?.phone_number);
    if (p) { customerPhone = p; customerSmsDisabled = prof?.sms_notifications_enabled === false; }
  } else if (needKinds.has("customer") || !customerName) {
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

  // همکاران سفارش فقط وقتی پیام می‌گیرند که مدیریت کلید پیامک همان همکار را روشن کرده باشد
  let collaboratorPhones: string[] = [];
  if (needKinds.has("collaborators") || copyAllowed) {
    const { data: collabs } = await admin.from("order_collaborators")
      .select("invitee_phone_number, invitee_user_id, sms_enabled")
      .eq("order_id", o.id).eq("status", "accepted").eq("sms_enabled", true);
    const ids = (collabs || []).map((c: any) => c.invitee_user_id).filter(Boolean);
    const { data: profs } = ids.length ? await admin.from("profiles").select("user_id, phone_number, sms_notifications_enabled").in("user_id", ids) : { data: [] as any[] };
    const profByUser = new Map((profs || []).map((p: any) => [p.user_id, p]));
    collaboratorPhones = enabledCollaboratorPhones((collabs || []).map((c: any) => {
      const prof = profByUser.get(c.invitee_user_id) as any;
      return {
        phone: c.invitee_phone_number || prof?.phone_number,
        sms_enabled: c.sms_enabled,
        sms_opted_out: prof?.sms_notifications_enabled === false,
      };
    }), customerPhone);
  }

  // شخص مرتبط با رویداد (گیرنده انتقال یا همکار) فقط با رضایت پیامکی خودش پیام می‌گیرد
  const eventPersonPhone = resolvedEvent?.personPhone || null;
  let eventPersonSmsDisabled = false;
  if (eventPersonPhone && needKinds.has("event_person")) {
    const prof = await profileOf(admin, resolvedEvent?.personUserId);
    if (prof?.sms_notifications_enabled === false) eventPersonSmsDisabled = true;
    else {
      const { data: byPhone } = await admin.from("profiles").select("sms_notifications_enabled").eq("phone_number", eventPersonPhone).maybeSingle();
      if (byPhone?.sms_notifications_enabled === false) eventPersonSmsDisabled = true;
    }
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

  // نام پروژه برای متغیر {projectName}
  let eventVars: Record<string, string> | undefined;
  if (resolvedEvent) {
    let projectName = "";
    const { data: full } = await admin.from("projects_v3").select("hierarchy_project_id").eq("id", o.id).maybeSingle();
    if (full?.hierarchy_project_id) {
      const { data: hp } = await admin.from("projects_hierarchy").select("title, location_id").eq("id", full.hierarchy_project_id).maybeSingle();
      projectName = String(hp?.title || "").trim();
      if (!projectName && hp?.location_id) {
        const { data: loc } = await admin.from("locations").select("title").eq("id", hp.location_id).maybeSingle();
        projectName = String(loc?.title || "").trim();
      }
    }
    if (!projectName) projectName = String(o.address || "").trim();
    eventVars = { projectName, ...(resolvedEvent.vars || {}) };
    if (!eventVars.ownerName) eventVars.ownerName = String(customerName || "").trim();
  }
  const claimRef = resolvedEvent?.eventRef || o.id;
  const claimWindow = resolvedEvent ? EVENT_DEDUPE_SECONDS : DISPATCH_DEDUPE_SECONDS;

  const jobs: Array<Record<string, unknown>> = [];
  for (const f of frames) {
    const recipients = resolveFrameRecipients(f, {
      customerPhone, customerSmsDisabled, skipCustomer, collaboratorPhones, rolePhones, eventPersonPhone, eventPersonSmsDisabled,
    }).filter((r) => !collaboratorsOnly || r.kind === "collaborators");
    for (const r of recipients) {
      const { data: claimed } = await admin.rpc("claim_sms_dispatch", {
        _key: dispatchClaimKey(claimRef, stage, f.key, r.phone),
        _window_seconds: claimWindow,
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
        eventVars,
        eventRef: resolvedEvent?.eventRef,
      });
    }
  }

  // === نسخه پیام مرحله برای همکاران روشن (همان پیامی که مشتری در این مرحله می‌گیرد) ===
  let collaboratorCopies = 0;
  if (copyAllowed) {
    for (const phone of collaboratorPhones) {
      const { data: claimed } = await admin.rpc("claim_sms_dispatch", {
        _key: dispatchClaimKey(o.id, stage, COLLABORATOR_COPY_FRAME_KEY, phone),
        _window_seconds: DISPATCH_DEDUPE_SECONDS,
      });
      if (claimed !== true) continue;
      collaboratorCopies++;
      jobs.push({
        phone,
        orderCode: o.code,
        orderId: o.id,
        status: stage,
        audience: "collaborator",
        serviceType,
        address,
        customerName: details.customerName || customerName,
        description: details.description,
        amount: amountCandidates[0],
        paidAmount: details.paidAmount,
        totalPaid: details.totalPaid,
        remainingAmount: details.remainingAmount,
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

  console.log(`[dispatch-order-messages] order ${o.code} stage ${stage}${resolvedEvent ? ` (${resolvedEvent.eventRef})` : ""}: ${frames.length} frame(s), ${jobs.length} message(s)`);
  return json({ success: true, frames: frames.length, recipients: jobs.length, collaboratorCopies });
});
