// المان‌های سفارشی پیامک: مدیر یک نام (مثلاً {تاریخ_واریز}) می‌سازد و آن را به یکی از
// داده‌های همان سفارش وصل می‌کند؛ هنگام ارسال، مقدار واقعی همان سفارش جایگزین می‌شود.
// این فایل فقط به فهرست متغیرهای رویداد وابسته است تا هم سرور ارسال پیامک و هم صفحه مدیریت از آن استفاده کنند.
// همه المان‌های قدیمی سایت ({code}، {serviceType} و ...) هم به شکل «المان پایه» با نام فارسی در همین فهرست هستند
// تا مدیر بتواند شکل نوشتن، متن جایگزین و حتی منبع آن‌ها را ویرایش کند.
import { EVENT_VARIABLES } from "./smsOrderEvents.ts";

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
  /** اطلاعات پایه همین پیام که سرور ارسال می‌سازد (کد، نوع خدمات با زیرشاخه، آدرس، لینک‌ها و ...) */
  base?: Record<string, string | number | null | undefined> | null;
  /** متغیرهای رویداد (تمدید، تعمیر، تخفیف، انتقال، همکار) */
  event?: Record<string, string> | null;
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
  /** نام قدیمی انگلیسی همین المان (مثلاً code) که در متن‌های قدیمی هنوز ممکن است باشد */
  legacy_token?: string | null;
  is_system?: boolean | null;
}

type SourceValue = string | number | null | undefined;

interface SourceDef {
  key: string;
  label: string;
  group: string;
  kind: SmsVariableKind;
  hint?: string;
  /** فقط برای منابع رویداد: گروه مراحلی که این اطلاعات را دارند */
  eventGroups?: string[];
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
const b = (s: SmsOrderSnapshot, k: string): SourceValue => {
  const v = s.base?.[k];
  return typeof v === "string" ? (v.trim() || null) : v ?? null;
};

export const BASE_SOURCE_GROUP = "اطلاعات پایه سفارش";
export const EVENT_SOURCE_GROUP = "رویدادها (تمدید، تعمیر، تخفیف، انتقال، همکار)";
export const EVENT_SOURCE_PREFIX = "event_";

const BASE_SOURCES: SourceDef[] = [
  { key: "base_code", group: BASE_SOURCE_GROUP, kind: "text", label: "کد سفارش", resolve: (s) => b(s, "code") },
  { key: "base_service_stage", group: BASE_SOURCE_GROUP, kind: "text", label: "نوع خدمات با زیرشاخه و مرحله سفارش",
    hint: "مثلاً «خدمات داربست فلزی - اجرای داربست به همراه اجناس (تایید شد)»؛ مرحله سفارش داخل پرانتز می‌آید",
    resolve: (s) => b(s, "serviceStage") },
  { key: "base_service_full", group: BASE_SOURCE_GROUP, kind: "text", label: "نوع خدمات با زیرشاخه (بدون مرحله)",
    hint: "مثلاً «خدمات داربست فلزی - اجرای داربست بدون اجناس»", resolve: (s) => b(s, "serviceFull") },
  { key: "base_service_type", group: BASE_SOURCE_GROUP, kind: "text", label: "فقط نوع خدمات (مثلاً داربست فلزی)",
    resolve: (s) => b(s, "serviceTypeName") },
  { key: "base_service_subcategory", group: BASE_SOURCE_GROUP, kind: "text", label: "فقط زیرشاخه خدمات (مثلاً اجرای داربست به همراه اجناس)",
    resolve: (s) => b(s, "subcategoryName") },
  { key: "base_service_form", group: BASE_SOURCE_GROUP, kind: "text", label: "نوع خدمت ثبت‌شده در فرم سفارش (مثلاً داربست نما)",
    resolve: (s) => b(s, "serviceForm") },
  { key: "base_stage_label", group: BASE_SOURCE_GROUP, kind: "text", label: "مرحله سفارش در همین پیام (مثلاً اجرا شد)",
    resolve: (s) => b(s, "stageLabel") },
  { key: "base_customer_name", group: BASE_SOURCE_GROUP, kind: "text", label: "نام مشتری", resolve: (s) => b(s, "customerName") },
  { key: "base_address", group: BASE_SOURCE_GROUP, kind: "text", label: "آدرس سفارش", resolve: (s) => b(s, "address") },
  { key: "base_description", group: BASE_SOURCE_GROUP, kind: "text", label: "شرح فعالیت سفارش", resolve: (s) => b(s, "description") },
  { key: "base_order_link", group: BASE_SOURCE_GROUP, kind: "text", label: "لینک سفارش", resolve: (s) => b(s, "orderLink") },
  { key: "base_payment_link", group: BASE_SOURCE_GROUP, kind: "text", label: "لینک پرداخت سفارش", resolve: (s) => b(s, "paymentLink") },
  { key: "base_now", group: BASE_SOURCE_GROUP, kind: "date", label: "تاریخ و ساعت ارسال پیام", resolve: (s) => b(s, "now") },
  { key: "base_amount", group: BASE_SOURCE_GROUP, kind: "amount", label: "مبلغ همین پیام (مبلغ سفارش یا پرداخت)",
    resolve: (s) => num(b(s, "amount")) || null },
  { key: "base_paid_amount", group: BASE_SOURCE_GROUP, kind: "amount", label: "مبلغ همین پرداخت (یا آخرین پرداخت)",
    resolve: (s) => num(b(s, "paidAmount")) },
  { key: "base_total_paid", group: BASE_SOURCE_GROUP, kind: "amount", label: "مجموع پرداخت‌شده سفارش", resolve: (s) => num(b(s, "totalPaid")) },
  { key: "base_remaining", group: BASE_SOURCE_GROUP, kind: "amount", label: "مانده سفارش", resolve: (s) => num(b(s, "remaining")) },
  { key: "base_payment_date", group: BASE_SOURCE_GROUP, kind: "date", label: "تاریخ واریز آخرین پرداخت (هنگام پرداخت: امروز)",
    resolve: (s) => b(s, "paymentDate") },
  { key: "base_collection_date", group: BASE_SOURCE_GROUP, kind: "date", label: "تاریخ جمع‌آوری (تاییدشده، وگرنه درخواستی)",
    resolve: (s) => b(s, "collectionDate") },
];

const EVENT_SOURCES: SourceDef[] = EVENT_VARIABLES.map((v) => {
  const key = v.token.slice(1, -1);
  return {
    key: `${EVENT_SOURCE_PREFIX}${key}`, group: EVENT_SOURCE_GROUP, kind: "text" as const, label: v.label,
    hint: "فقط در قاب‌های پیام همین نوع رویداد مقدار دارد", eventGroups: v.groups,
    resolve: (s: SmsOrderSnapshot) => (s.event?.[key] || "").trim() || null,
  };
});

const SOURCES: SourceDef[] = [
  ...BASE_SOURCES,
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
  ...EVENT_SOURCES,
];

export const SMS_VARIABLE_SOURCES = SOURCES.map(({ key, label, group, kind, hint, eventGroups }) => ({ key, label, group, kind, hint, eventGroups }));

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

export interface SystemSmsElement {
  legacy: string;
  token: string;
  label: string;
  source_key: string;
  format: SmsVariableFormat;
  fallback: string;
}

/**
 * المان‌های پایه سایت با نام فارسی؛ هر کدام جایگزین یک نام قدیمی انگلیسی است.
 * در پایگاه داده به‌صورت ردیف‌های قابل ویرایش (is_system) ذخیره شده‌اند و متن‌های قدیمی خودکار به نام جدید ترجمه می‌شوند.
 */
export const SYSTEM_SMS_ELEMENTS: SystemSmsElement[] = [
  { legacy: "code", token: "کد", label: "کد سفارش", source_key: "base_code", format: "text", fallback: "ثبت نشده" },
  { legacy: "serviceType", token: "نوع_خدمات", label: "نوع خدمات با زیرشاخه (و مرحله سفارش)", source_key: "base_service_stage", format: "text", fallback: "خدمات" },
  { legacy: "address", token: "آدرس", label: "آدرس سفارش", source_key: "base_address", format: "text", fallback: "ثبت نشده" },
  { legacy: "customerName", token: "نام_مشتری", label: "نام مشتری", source_key: "base_customer_name", format: "text", fallback: "مشتری" },
  { legacy: "dateTime", token: "تاریخ_و_ساعت", label: "تاریخ و ساعت ارسال پیام", source_key: "base_now", format: "datetime", fallback: "ثبت نشده" },
  { legacy: "amount", token: "مبلغ", label: "مبلغ سفارش / پرداخت (فقط عدد)", source_key: "base_amount", format: "number", fallback: "تعیین نشده" },
  { legacy: "orderLink", token: "لینک_سفارش", label: "لینک سفارش", source_key: "base_order_link", format: "text", fallback: "https://ahrom.ir/my-orders" },
  { legacy: "description", token: "شرح_فعالیت", label: "شرح فعالیت سفارش", source_key: "base_description", format: "text", fallback: "ثبت نشده" },
  { legacy: "paymentLink", token: "لینک_پرداخت", label: "لینک پرداخت سفارش", source_key: "base_payment_link", format: "text", fallback: "https://ahrom.ir/user/orders" },
  { legacy: "rentalStartDate", token: "تاریخ_شروع_کرایه", label: "تاریخ شروع کرایه", source_key: "order_rental_start", format: "date", fallback: "ثبت نشده" },
  { legacy: "executionDate", token: "تاریخ_اجرا", label: "تاریخ اجرای سفارش", source_key: "order_execution_end", format: "date", fallback: "ثبت نشده" },
  { legacy: "collectionDate", token: "تاریخ_جمع_آوری", label: "تاریخ جمع‌آوری", source_key: "base_collection_date", format: "date", fallback: "ثبت نشده" },
  { legacy: "completionDate", token: "تاریخ_اتمام", label: "تاریخ اتمام سفارش", source_key: "order_completed_at", format: "date", fallback: "ثبت نشده" },
  { legacy: "paymentDate", token: "تاریخ_واریز", label: "تاریخ واریز آخرین پرداخت", source_key: "base_payment_date", format: "date", fallback: "ثبت نشده" },
  { legacy: "paidAmount", token: "مبلغ_پرداخت", label: "مبلغ همین پرداخت", source_key: "base_paid_amount", format: "toman", fallback: "ثبت نشده" },
  { legacy: "totalPaid", token: "مجموع_پرداخت_شده", label: "مجموع پرداخت‌شده", source_key: "base_total_paid", format: "toman", fallback: "ثبت نشده" },
  { legacy: "remainingAmount", token: "مانده_سفارش", label: "مانده سفارش", source_key: "base_remaining", format: "toman", fallback: "ثبت نشده" },
  // متغیرهای رویداد
  { legacy: "projectName", token: "نام_پروژه", label: "نام پروژه (محل سفارش)", source_key: "event_projectName", format: "text", fallback: "ثبت نشده" },
  { legacy: "renewalMonth", token: "ماه_تمدید", label: "ماه تمدید (مثلاً ماه دوم)", source_key: "event_renewalMonth", format: "text", fallback: "ثبت نشده" },
  { legacy: "renewalPrice", token: "مبلغ_تمدید", label: "مبلغ تمدید", source_key: "event_renewalPrice", format: "text", fallback: "ثبت نشده" },
  { legacy: "renewalStartDate", token: "تاریخ_شروع_تمدید", label: "تاریخ شروع تمدید", source_key: "event_renewalStartDate", format: "text", fallback: "ثبت نشده" },
  { legacy: "renewalEndDate", token: "تاریخ_پایان_تمدید", label: "تاریخ پایان تمدید", source_key: "event_renewalEndDate", format: "text", fallback: "ثبت نشده" },
  { legacy: "repairCost", token: "هزینه_تعمیر", label: "هزینه تعمیر", source_key: "event_repairCost", format: "text", fallback: "ثبت نشده" },
  { legacy: "repairDescription", token: "شرح_تعمیر", label: "شرح تعمیر", source_key: "event_repairDescription", format: "text", fallback: "ثبت نشده" },
  { legacy: "repairDate", token: "تاریخ_درخواست_تعمیر", label: "تاریخ درخواست تعمیر", source_key: "event_repairDate", format: "text", fallback: "ثبت نشده" },
  { legacy: "discountAmount", token: "مبلغ_تخفیف", label: "مبلغ تخفیف", source_key: "event_discountAmount", format: "text", fallback: "ثبت نشده" },
  { legacy: "priceBeforeDiscount", token: "مبلغ_قبل_از_تخفیف", label: "مبلغ قبل از تخفیف", source_key: "event_priceBeforeDiscount", format: "text", fallback: "ثبت نشده" },
  { legacy: "priceAfterDiscount", token: "مبلغ_پس_از_تخفیف", label: "مبلغ پس از تخفیف", source_key: "event_priceAfterDiscount", format: "text", fallback: "ثبت نشده" },
  { legacy: "discountNote", token: "توضیح_تخفیف", label: "توضیح تخفیف", source_key: "event_discountNote", format: "text", fallback: "ثبت نشده" },
  { legacy: "personName", token: "نام_شخص", label: "نام گیرنده انتقال / همکار", source_key: "event_personName", format: "text", fallback: "ثبت نشده" },
  { legacy: "personPhone", token: "شماره_شخص", label: "شماره گیرنده انتقال / همکار", source_key: "event_personPhone", format: "text", fallback: "ثبت نشده" },
  { legacy: "ownerName", token: "نام_مالک_سفارش", label: "نام کاربری مالک سفارش (انتقال‌دهنده / دعوت‌کننده)", source_key: "event_ownerName", format: "text", fallback: "ثبت نشده" },
  { legacy: "reason", token: "دلیل_رد", label: "دلیل رد", source_key: "event_reason", format: "text", fallback: "ثبت نشده" },
];

// نام‌های قدیمی انگلیسی؛ المان جدید نباید هم‌نام آن‌ها باشد تا با متن‌های قدیمی قاطی نشود
export const BUILTIN_SMS_TOKENS = SYSTEM_SMS_ELEMENTS.map((e) => e.legacy);

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** نام‌های قدیمی انگلیسی ({code} و ...) را با نام فارسی فعلی همان المان جایگزین می‌کند */
export function translateLegacySmsTokens(message: string, variables: SmsCustomVariable[]): string {
  let out = message || "";
  if (!out.includes("{")) return out;
  for (const v of variables) {
    const legacy = (v.legacy_token || "").trim();
    if (!legacy || !v.token) continue;
    out = out.replace(new RegExp(`\\{${escapeRe(legacy)}\\}`, "g"), `{${v.token}}`);
  }
  return out;
}

/** متن را با نام‌های فارسی پیش‌فرض المان‌های پایه می‌نویسد (برای متن‌های آماده داخل برنامه) */
export const persianizeSmsTokens = (message: string) =>
  translateLegacySmsTokens(message, SYSTEM_SMS_ELEMENTS.map((e) => ({ token: e.token, source_key: e.source_key, legacy_token: e.legacy })));

/** نام المان را در متن قالب عوض می‌کند (وقتی مدیر نام یک المان را ویرایش می‌کند) */
export const renameSmsTokenInText = (message: string, from: string, to: string) =>
  !from || from === to ? message : (message || "").split(`{${from}}`).join(`{${to}}`);

export const isEventSource = (key?: string | null) => !!key && key.startsWith(EVENT_SOURCE_PREFIX);

/**
 * المان‌هایی که زیر متن هر پیام برای افزودن نشان داده می‌شوند: المان‌های فعال (پایه و ساخته‌شده)،
 * و المان‌های رویداد فقط در قاب‌های همان نوع رویداد.
 */
export function smsElementsFor<T extends { source_key: string; enabled?: boolean | null }>(
  variables: T[], eventGroup?: string | null,
): T[] {
  return variables.filter((v) => {
    if (v.enabled === false) return false;
    if (!isEventSource(v.source_key)) return true;
    if (!eventGroup) return false;
    const src = SOURCES.find((s) => s.key === v.source_key);
    return !!src?.eventGroups?.includes(eventGroup);
  });
}

/** ترتیب نمایش: المان‌های پایه به ترتیب سایت، سپس المان‌های ساخته‌شده مدیر */
export const sortSmsElements = <T extends { token: string; is_system?: boolean | null; sort_order?: number | null }>(list: T[]) =>
  [...list].sort((a, b) =>
    (a.is_system ? 0 : 1) - (b.is_system ? 0 : 1) || (a.sort_order ?? 1000) - (b.sort_order ?? 1000));

/** نوع خدمات و زیرشاخه را خوانا می‌نویسد: «خدمات داربست فلزی - اجرای داربست به همراه اجناس» */
export function formatServiceWithSubcategory(typeName?: string | null, subName?: string | null): string {
  const strip = (v?: string | null) => String(v || "").trim().replace(/^خدمات\s+/, "").trim();
  const t = strip(typeName);
  let sub = strip(subName);
  if (sub === "عمومی") sub = "";
  if (t && sub) return `خدمات ${t} - ${sub}`;
  if (t) return `خدمات ${t}`;
  return sub ? `خدمات ${sub}` : "";
}

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
  if (!/^[\p{L}][\p{L}\p{N}_\u200c]*$/u.test(t)) return "نام المان فقط می‌تواند حروف، عدد و _ داشته باشد و با حرف شروع شود";
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
