// رویدادهای جانبی سفارش (تمدید، تعمیرات، تخفیف، انتقال سفارش و همکاران) برای قاب‌های پیام سفارشی.
// پایگاه داده هر تغییر وضعیت را گزارش می‌کند و این فایل مشخص می‌کند کدام مرحله قاب پیام رخ داده است
// و متغیرهای مخصوص همان رویداد چگونه در متن پیام جایگزین می‌شوند. بین سرور و صفحه مدیریت پیامک‌ها مشترک است.
import type { FrameStageGroup } from "./smsCustomFrames.ts";

export const ORDER_EVENT_TABLES = [
  "order_renewals",
  "repair_requests",
  "order_transfer_requests",
  "order_collaborators",
  "projects_v3",
] as const;
export type OrderEventTable = (typeof ORDER_EVENT_TABLES)[number];

/** رویداد فقط تا این مدت پس از آخرین تغییرش پذیرفته می‌شود (جلوگیری از ارسال دوباره رویدادهای قدیمی) */
export const EVENT_RECENCY_MINUTES = 15;
/** هر رویداد برای هر گیرنده و هر قاب در این بازه فقط یک بار پیام می‌فرستد */
export const EVENT_DEDUPE_SECONDS = 2 * 24 * 60 * 60;

const TRANSFER_AWAITING = ["pending_recipient", "pending_registration"];
const COLLAB_AWAITING = ["pending", "pending_registration"];

/**
 * مرحله قاب پیام برای یک تغییر وضعیت در جدول‌های رویداد؛ null یعنی این تغییر پیامی ندارد.
 * برای تخفیف (projects_v3) مرحله فقط وقتی رخ می‌دهد که مبلغ تخفیف مثبت باشد و تغییر کرده باشد.
 */
export function eventStageFor(
  table: OrderEventTable,
  op: "INSERT" | "UPDATE",
  oldStatus: string | null | undefined,
  newStatus: string | null | undefined,
): string | null {
  const to = newStatus || "";
  if (op === "UPDATE" && table !== "projects_v3" && (oldStatus || "") === to) return null;
  switch (table) {
    case "order_renewals":
      if (to === "approved") return "renewal_approved";
      if (to === "rejected") return op === "UPDATE" ? "renewal_rejected" : null;
      if (op === "INSERT") return "renewal_requested";
      return null;
    case "repair_requests":
      if (op === "INSERT") return to === "rejected" ? null : "repair_requested";
      if (to === "approved") return "repair_approved";
      if (to === "awaiting_repair") return "repair_scheduled";
      if (to === "repaired") return "repair_completed";
      if (to === "rejected") return "repair_rejected";
      return null;
    case "order_transfer_requests":
      if (to === "completed") return "transfer_completed";
      if (TRANSFER_AWAITING.includes(to) && !TRANSFER_AWAITING.includes(oldStatus || "")) return "transfer_requested";
      if ((to === "manager_rejected" || to === "recipient_rejected") && op === "UPDATE") return "transfer_rejected";
      return null;
    case "order_collaborators":
      if (to === "accepted") return "collaborator_added";
      if (COLLAB_AWAITING.includes(to) && !COLLAB_AWAITING.includes(oldStatus || "")) return "collaborator_invited";
      return null;
    case "projects_v3":
      return "discount_applied";
  }
  return null;
}

export interface EventVariable {
  token: string;
  label: string;
  groups: FrameStageGroup[];
  sample: string;
}

/** متغیرهای مخصوص رویدادها؛ در هر مرحله فقط متغیرهای گروه همان مرحله پیشنهاد می‌شوند */
export const EVENT_VARIABLES: EventVariable[] = [
  { token: "{projectName}", label: "نام پروژه (محل سفارش)", groups: ["renewal", "repair", "discount", "transfer", "collaboration"], sample: "خیابان نمونه" },
  { token: "{renewalMonth}", label: "ماه تمدید (مثلاً ماه دوم)", groups: ["renewal"], sample: "ماه دوم" },
  { token: "{renewalPrice}", label: "مبلغ تمدید", groups: ["renewal"], sample: "۴٬۵۰۰٬۰۰۰ تومان" },
  { token: "{renewalStartDate}", label: "تاریخ شروع تمدید", groups: ["renewal"], sample: "1405/08/20" },
  { token: "{renewalEndDate}", label: "تاریخ پایان تمدید", groups: ["renewal"], sample: "1405/09/20" },
  { token: "{repairCost}", label: "هزینه تعمیر", groups: ["repair"], sample: "۱٬۲۰۰٬۰۰۰ تومان" },
  { token: "{repairDescription}", label: "شرح تعمیر", groups: ["repair"], sample: "تعویض دو جک و بستن مهاربند" },
  { token: "{repairDate}", label: "تاریخ درخواست تعمیر", groups: ["repair"], sample: "1405/08/24" },
  { token: "{discountAmount}", label: "مبلغ تخفیف", groups: ["discount"], sample: "۵۰۰٬۰۰۰ تومان" },
  { token: "{priceBeforeDiscount}", label: "مبلغ قبل از تخفیف", groups: ["discount"], sample: "۱۰٬۰۰۰٬۰۰۰ تومان" },
  { token: "{priceAfterDiscount}", label: "مبلغ پس از تخفیف", groups: ["discount"], sample: "۹٬۵۰۰٬۰۰۰ تومان" },
  { token: "{discountNote}", label: "توضیح تخفیف", groups: ["discount"], sample: "تخفیف مشتری وفادار" },
  { token: "{personName}", label: "نام گیرنده انتقال / همکار", groups: ["transfer", "collaboration"], sample: "محمد احمدی" },
  { token: "{personPhone}", label: "شماره گیرنده انتقال / همکار", groups: ["transfer", "collaboration"], sample: "09121234567" },
  { token: "{ownerName}", label: "نام کاربری مالک سفارش (انتقال‌دهنده / دعوت‌کننده)", groups: ["transfer", "collaboration"], sample: "علی رضایی" },
  { token: "{statementNumber}", label: "شماره صورتحساب (یا «همه صورتحساب‌ها»)", groups: ["statement"], sample: "۳" },
  { token: "{statementTotal}", label: "مبلغ کل صورتحساب", groups: ["statement"], sample: "۲۰٬۰۰۰٬۰۰۰ تومان" },
  { token: "{statementPaid}", label: "مجموع پرداخت‌شده صورتحساب", groups: ["statement"], sample: "۱۲٬۰۰۰٬۰۰۰ تومان" },
  { token: "{statementRemaining}", label: "مانده صورتحساب (پس از تخفیف)", groups: ["statement"], sample: "۷٬۵۰۰٬۰۰۰ تومان" },
  { token: "{statementDiscount}", label: "مبلغ تخفیف صورتحساب", groups: ["statement"], sample: "۵۰۰٬۰۰۰ تومان" },
  { token: "{statementDiscountNote}", label: "توضیح تخفیف صورتحساب", groups: ["statement"], sample: "تخفیف خورده حساب" },
  { token: "{statementPaymentAmount}", label: "مبلغ همین پرداخت صورتحساب", groups: ["statement"], sample: "۱۲٬۰۰۰٬۰۰۰ تومان" },
  { token: "{statementPaymentMethod}", label: "روش پرداخت (نقدی، کارت به کارت، چک)", groups: ["statement"], sample: "کارت به کارت" },
  { token: "{statementDepositDate}", label: "تاریخ واریز / سررسید چک", groups: ["statement"], sample: "1405/08/20" },
  { token: "{statementAllocation}", label: "سهم پرداخت از هر سفارش و صورتحساب", groups: ["statement"], sample: "سفارش 1000539 (صورتحساب ۳): ۸٬۰۰۰٬۰۰۰ تومان، سفارش 1000540 (صورتحساب ۴): ۴٬۰۰۰٬۰۰۰ تومان" },
  { token: "{statementOrderCodes}", label: "کد سفارش‌های صورتحساب / پرداخت", groups: ["statement"], sample: "1000539، 1000540" },
  { token: "{statementClosedDate}", label: "تاریخ بستن صورتحساب", groups: ["statement"], sample: "1405/08/25" },
  { token: "{reason}", label: "دلیل رد", groups: ["renewal", "repair", "transfer", "collaboration"], sample: "تاریخ درخواستی در دسترس نیست" },
];
export const EVENT_VARIABLE_TOKENS = EVENT_VARIABLES.map((v) => v.token);
const EVENT_KEYS = new Set(EVENT_VARIABLES.map((v) => v.token.slice(1, -1)));

export const eventVariablesFor = (group?: FrameStageGroup | null) =>
  group ? EVENT_VARIABLES.filter((v) => v.groups.includes(group)) : [];

/** فقط کلیدهای شناخته‌شده با متن کوتاه پذیرفته می‌شوند */
export function sanitizeEventVars(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!EVENT_KEYS.has(k)) continue;
    if (typeof v !== "string" && typeof v !== "number") continue;
    const text = String(v).replace(/[\r\n]+/g, " ").trim().slice(0, 600);
    if (text) out[k] = text;
  }
  return out;
}

/** متغیرهای رویداد را در متن پیام جایگزین می‌کند؛ متغیری که برای این رویداد مقدار ندارد «ثبت نشده» می‌شود. */
export function applyEventVariables(message: string, vars?: Record<string, string> | null): string {
  let out = message;
  for (const token of EVENT_VARIABLE_TOKENS) {
    if (!out.includes(token)) continue;
    out = out.split(token).join(vars?.[token.slice(1, -1)] || "ثبت نشده");
  }
  return out;
}

export const sampleEventVars = (): Record<string, string> =>
  Object.fromEntries(EVENT_VARIABLES.map((v) => [v.token.slice(1, -1), v.sample]));

const ORDINALS = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم", "یازدهم", "دوازدهم"];
/** شماره تمدید (۱ = تمدید اول) به ماه کرایه: ۱ ← «ماه دوم» */
export function renewalMonthLabel(renewalNumber: number | null | undefined): string {
  const n = Number(renewalNumber);
  if (!Number.isFinite(n) || n < 1) return "ثبت نشده";
  const month = Math.floor(n) + 1;
  return month <= ORDINALS.length ? `ماه ${ORDINALS[month - 1]}` : `ماه ${month.toLocaleString("fa-IR")}م`;
}

const toEn = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function jalaliDate(value?: string | null): string {
  if (!value) return "ثبت نشده";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "ثبت نشده";
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => toEn(parts.find((p) => p.type === t)?.value || "");
  return `${get("year").replace(/[^0-9]/g, "")}/${get("month")}/${get("day")}`;
}

export const eventMoney = (n: unknown): string => {
  const v = Number(n);
  return n !== null && n !== undefined && n !== "" && Number.isFinite(v) ? `${Math.max(0, v).toLocaleString("fa-IR")} تومان` : "ثبت نشده";
};

/** آیا رویداد هنوز تازه است؟ (آخرین تغییر سطر در بازه پذیرش) */
export function isRecentEvent(timestamps: Array<string | null | undefined>, now = Date.now()): boolean {
  const latest = Math.max(...timestamps.map((t) => (t ? new Date(t).getTime() : NaN)).filter((t) => Number.isFinite(t)));
  return Number.isFinite(latest) && now - latest <= EVENT_RECENCY_MINUTES * 60_000 && latest - now <= 60_000;
}
