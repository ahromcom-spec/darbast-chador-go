// المان‌های سفارشی پیامک: مدیر یک نام (مثلاً {تاریخ_واریز}) می‌سازد و آن را به یکی از
// داده‌های همان سفارش وصل می‌کند؛ هنگام ارسال، مقدار واقعی همان سفارش جایگزین می‌شود.
// این فایل بدون وابستگی است تا هم سرور ارسال پیامک و هم صفحه مدیریت از آن استفاده کنند.

export type SmsVariableKind = "date" | "amount" | "count" | "text";
export type SmsVariableFormat = "auto" | "date" | "datetime" | "weekday_date" | "toman" | "number" | "text";

export interface SmsPaymentRow {
  amount: number | string | null;
  payment_date?: string | null;
  created_at?: string | null;
  receipt_number?: string | null;
}
export interface SmsRenewalRow {
  renewal_number?: number | null;
  new_start_date?: string | null;
  new_end_date?: string | null;
  renewal_price?: number | string | null;
  status?: string | null;
  created_at?: string | null;
}
export interface SmsCollectionRow {
  requested_date?: string | null;
  confirmed_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
}
export interface SmsOrderSnapshot {
  order: Record<string, any> | null;
  payments: SmsPaymentRow[];
  renewals: SmsRenewalRow[];
  collection: SmsCollectionRow | null;
}

export interface SmsCustomVariable {
  token: string;
  label?: string;
  source_key: string;
  format?: string | null;
  fallback?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  enabled?: boolean | null;
}

type SourceValue = string | number | null | undefined;

interface SourceDef {
  key: string;
  label: string;
  group: string;
  kind: SmsVariableKind;
  hint?: string;
  resolve: (s: SmsOrderSnapshot) => SourceValue;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const time = (v?: string | null) => {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
};
// آخرین پرداختی که در سایت ثبت شده (همان پرداختی که الان ثبت کردید)، حتی اگر تاریخ واریزش قدیمی‌تر باشد
const latestRegistered = (s: SmsOrderSnapshot) =>
  [...s.payments].sort((a, b) => (time(b.created_at) || 0) - (time(a.created_at) || 0))[0];
const firstDeposited = (s: SmsOrderSnapshot) =>
  [...s.payments].sort((a, b) =>
    (time(a.payment_date || a.created_at) || 0) - (time(b.payment_date || b.created_at) || 0))[0];
const paymentsSum = (s: SmsOrderSnapshot) =>
  s.payments.reduce((sum, p) => sum + (num(p.amount) ?? 0), 0);
const approvedRenewals = (s: SmsOrderSnapshot) =>
  s.renewals
    .filter((r) => !r.status || r.status === "approved")
    .sort((a, b) => (num(b.renewal_number) ?? 0) - (num(a.renewal_number) ?? 0) || (time(b.created_at) || 0) - (time(a.created_at) || 0));
const o = (s: SmsOrderSnapshot, k: string) => s.order?.[k] ?? null;

const SOURCES: SourceDef[] = [
  // پرداخت‌ها
  { key: "payment_latest_deposit_date", group: "پرداخت", kind: "date", label: "تاریخ واریز آخرین پرداخت ثبت‌شده",
    hint: "همان تاریخی که هنگام ثبت پرداخت در کادر «تاریخ واریز» انتخاب می‌کنید، حتی اگر چند روز قبل باشد",
    resolve: (s) => { const p = latestRegistered(s); return p ? (p.payment_date || p.created_at) : null; } },
  { key: "payment_latest_registered_at", group: "پرداخت", kind: "date", label: "تاریخ ثبت آخرین پرداخت در سایت",
    hint: "روزی که پرداخت در سایت وارد شده است، نه روز واریز",
    resolve: (s) => latestRegistered(s)?.created_at ?? null },
  { key: "payment_latest_amount", group: "پرداخت", kind: "amount", label: "مبلغ آخرین پرداخت ثبت‌شده",
    resolve: (s) => num(latestRegistered(s)?.amount) },
  { key: "payment_latest_receipt", group: "پرداخت", kind: "text", label: "شماره رسید آخرین پرداخت",
    resolve: (s) => (latestRegistered(s)?.receipt_number || "").trim() || null },
  { key: "payment_first_deposit_date", group: "پرداخت", kind: "date", label: "تاریخ واریز اولین پرداخت",
    resolve: (s) => { const p = firstDeposited(s); return p ? (p.payment_date || p.created_at) : null; } },
  { key: "payment_first_amount", group: "پرداخت", kind: "amount", label: "مبلغ اولین پرداخت",
    resolve: (s) => num(firstDeposited(s)?.amount) },
  { key: "payments_total", group: "پرداخت", kind: "amount", label: "جمع همه پرداخت‌های سفارش",
    resolve: (s) => (s.payments.length ? paymentsSum(s) : num(o(s, "total_paid"))) },
  { key: "payments_count", group: "پرداخت", kind: "count", label: "تعداد پرداخت‌های سفارش",
    resolve: (s) => s.payments.length },
  { key: "order_remaining", group: "پرداخت", kind: "amount", label: "مانده قابل پرداخت سفارش",
    resolve: (s) => {
      const total = num(o(s, "total_price"));
      if (total === null) return null;
      const paid = s.payments.length ? paymentsSum(s) : (num(o(s, "total_paid")) ?? 0);
      return Math.max(0, total - paid);
    } },
  { key: "order_payment_confirmed_at", group: "پرداخت", kind: "date", label: "تاریخ تسویه کامل سفارش",
    resolve: (s) => o(s, "payment_confirmed_at") },

  // سفارش
  { key: "order_created_at", group: "سفارش", kind: "date", label: "تاریخ ثبت سفارش", resolve: (s) => o(s, "created_at") },
  { key: "order_approved_at", group: "سفارش", kind: "date", label: "تاریخ تایید سفارش", resolve: (s) => o(s, "approved_at") },
  { key: "order_execution_start", group: "سفارش", kind: "date", label: "تاریخ شروع اجرا", resolve: (s) => o(s, "execution_start_date") },
  { key: "order_execution_end", group: "سفارش", kind: "date", label: "تاریخ اجرای سفارش (اجرا شد)", resolve: (s) => o(s, "execution_end_date") },
  { key: "order_rental_start", group: "سفارش", kind: "date", label: "تاریخ شروع کرایه", resolve: (s) => o(s, "rental_start_date") },
  { key: "order_rental_end", group: "سفارش", kind: "date", label: "تاریخ پایان کرایه", resolve: (s) => o(s, "rental_end_date") },
  { key: "order_completed_at", group: "سفارش", kind: "date", label: "تاریخ اتمام سفارش",
    resolve: (s) => o(s, "executive_completion_date") || o(s, "customer_completion_date") || o(s, "closed_at") },
  { key: "order_total_price", group: "سفارش", kind: "amount", label: "مبلغ کل سفارش", resolve: (s) => num(o(s, "total_price")) },
  { key: "order_discount", group: "سفارش", kind: "amount", label: "مبلغ تخفیف سفارش", resolve: (s) => num(o(s, "discount_amount")) },
  { key: "order_stage_note", group: "سفارش", kind: "text", label: "توضیحات آخرین مرحله سفارش",
    resolve: (s) => (String(o(s, "stage_note") || "").trim() || null) },

  // تمدید
  { key: "renewal_latest_start", group: "تمدید", kind: "date", label: "تاریخ شروع آخرین تمدید",
    resolve: (s) => approvedRenewals(s)[0]?.new_start_date ?? null },
  { key: "renewal_latest_end", group: "تمدید", kind: "date", label: "تاریخ پایان آخرین تمدید",
    resolve: (s) => approvedRenewals(s)[0]?.new_end_date ?? null },
  { key: "renewal_latest_price", group: "تمدید", kind: "amount", label: "مبلغ آخرین تمدید",
    resolve: (s) => num(approvedRenewals(s)[0]?.renewal_price) },
  { key: "renewals_count", group: "تمدید", kind: "count", label: "تعداد تمدیدهای تاییدشده",
    resolve: (s) => approvedRenewals(s).length },

  // جمع‌آوری
  { key: "collection_requested_date", group: "جمع‌آوری", kind: "date", label: "تاریخ درخواستی جمع‌آوری",
    resolve: (s) => s.collection?.requested_date ?? null },
  { key: "collection_confirmed_date", group: "جمع‌آوری", kind: "date", label: "تاریخ تاییدشده جمع‌آوری",
    resolve: (s) => s.collection?.confirmed_date ?? null },
  { key: "collection_completed_at", group: "جمع‌آوری", kind: "date", label: "تاریخ انجام جمع‌آوری",
    resolve: (s) => s.collection?.completed_at ?? null },
];

export const SMS_VARIABLE_SOURCES = SOURCES.map(({ key, label, group, kind, hint }) => ({ key, label, group, kind, hint }));

export const SMS_FORMATS_BY_KIND: Record<SmsVariableKind, { value: SmsVariableFormat; label: string }[]> = {
  date: [
    { value: "date", label: "تاریخ (1405/08/12)" },
    { value: "weekday_date", label: "روز هفته و تاریخ (جمعه 1405/08/12)" },
    { value: "datetime", label: "تاریخ و ساعت (1405/08/12 ساعت 10:30)" },
  ],
  amount: [
    { value: "toman", label: "مبلغ با تومان (۲٬۵۰۰٬۰۰۰ تومان)" },
    { value: "number", label: "فقط عدد (۲٬۵۰۰٬۰۰۰)" },
  ],
  count: [{ value: "number", label: "عدد" }],
  text: [{ value: "text", label: "متن" }],
};

// متغیرهای ثابت سیستم؛ المان سفارشی نباید هم‌نام آن‌ها باشد
export const BUILTIN_SMS_TOKENS = [
  "code", "serviceType", "address", "customerName", "dateTime", "amount", "orderLink", "description",
  "paymentLink", "rentalStartDate", "executionDate", "collectionDate", "completionDate", "paymentDate",
  "paidAmount", "totalPaid", "remainingAmount",
];

export const getSmsVariableSource = (key: string) => SMS_VARIABLE_SOURCES.find((s) => s.key === key) || null;

const toEnDigits = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
   .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** نام المان را بدون آکولاد و فاصله برمی‌گرداند؛ فاصله‌ها به _ تبدیل می‌شوند */
export const normalizeSmsToken = (raw: string) =>
  toEnDigits(String(raw || "")).trim().replace(/^\{+|\}+$/g, "").trim().replace(/\s+/g, "_");

export const validateSmsToken = (raw: string): string | null => {
  const t = normalizeSmsToken(raw);
  if (t.length < 2 || t.length > 40) return "نام المان باید بین ۲ تا ۴۰ حرف باشد";
  if (/[{}\s]/.test(t)) return "نام المان نباید آکولاد یا فاصله داشته باشد";
  if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(t)) return "نام المان فقط می‌تواند حروف، عدد و _ داشته باشد و با حرف شروع شود";
  if (BUILTIN_SMS_TOKENS.some((b) => b.toLowerCase() === t.toLowerCase())) return "این نام برای متغیرهای ثابت سایت رزرو شده است";
  return null;
};

const IRAN_TZ = "Asia/Tehran";
const jalaliParts = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: IRAN_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => toEnDigits(parts.find((p) => p.type === t)?.value || "");
  return `${get("year").replace(/[^0-9]/g, "")}/${get("month")}/${get("day")}`;
};
const clock = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: IRAN_TZ, hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  const h = get("hour") === "24" ? "00" : get("hour");
  return `${h}:${get("minute")}`;
};
const weekday = (d: Date) => new Intl.DateTimeFormat("fa-IR", { timeZone: IRAN_TZ, weekday: "long" }).format(d);

export const formatSmsVariableValue = (value: SourceValue, kind: SmsVariableKind, format?: string | null): string | null => {
  if (value === null || value === undefined || value === "") return null;
  const f = !format || format === "auto" ? SMS_FORMATS_BY_KIND[kind][0].value : format;
  if (kind === "date") {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return null;
    if (f === "datetime") return `${jalaliParts(d)} ساعت ${clock(d)}`;
    if (f === "weekday_date") return `${weekday(d)} ${jalaliParts(d)}`;
    return jalaliParts(d);
  }
  if (kind === "amount" || kind === "count") {
    const n = num(value);
    if (n === null) return null;
    const txt = Math.max(0, Math.round(n)).toLocaleString("fa-IR");
    return kind === "amount" && f !== "number" ? `${txt} تومان` : txt;
  }
  return String(value).trim() || null;
};

export const resolveSmsCustomVariable = (variable: SmsCustomVariable, snapshot: SmsOrderSnapshot): string => {
  const fallback = (variable.fallback ?? "").toString() || "ثبت نشده";
  const def = SOURCES.find((s) => s.key === variable.source_key);
  if (!def) return fallback;
  const formatted = formatSmsVariableValue(def.resolve(snapshot), def.kind, variable.format);
  if (formatted === null) return fallback;
  return `${variable.prefix ?? ""}${formatted}${variable.suffix ?? ""}`;
};

export const usedSmsCustomVariables = (message: string, variables: SmsCustomVariable[]) =>
  variables.filter((v) => message.includes(`{${v.token}}`));

/** المان‌های به‌کاررفته در متن را با مقدار همان سفارش جایگزین می‌کند؛ المان غیرفعال فقط متن جایگزین را می‌نویسد تا آکولاد خام به مشتری نرسد */
export const applySmsCustomVariables = (message: string, variables: SmsCustomVariable[], snapshot: SmsOrderSnapshot) => {
  let out = message;
  for (const v of usedSmsCustomVariables(message, variables)) {
    const value = v.enabled === false ? ((v.fallback ?? "").toString() || "ثبت نشده") : resolveSmsCustomVariable(v, snapshot);
    out = out.split(`{${v.token}}`).join(value);
  }
  return out;
};
