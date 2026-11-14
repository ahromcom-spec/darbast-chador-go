// قاب‌های پیام سفارشی: پیام‌هایی که مدیریت خودش می‌سازد و مشخص می‌کند در کدام مرحله سفارش،
// برای کدام خدمات و به چه کسانی (مشتری، همکاران سفارش، بخش‌های مدیریتی یا شماره‌های دلخواه) ارسال شود.
// این فایل بین سرور (ارسال) و صفحه مدیریت پیامک‌ها (نمایش و پوشش) مشترک است.

export const CUSTOM_FRAME_SCOPE = "custom";

export interface CustomFrameStage {
  key: string;
  label: string;
  hint: string;
}

/** همه مراحل سفارش که قاب پیام سفارشی می‌تواند به آن‌ها وصل شود (به ترتیب چرخه سفارش). */
export const CUSTOM_FRAME_STAGES: CustomFrameStage[] = [
  { key: "submitted", label: "ثبت سفارش", hint: "وقتی سفارش جدید ثبت می‌شود" },
  { key: "approved", label: "تایید سفارش", hint: "وقتی مدیریت سفارش را تایید می‌کند" },
  { key: "rejected", label: "رد سفارش", hint: "وقتی سفارش رد می‌شود" },
  { key: "in_progress", label: "شروع اجرا", hint: "وقتی اجرای سفارش شروع می‌شود" },
  { key: "executed", label: "اجرا شد", hint: "وقتی مرحله «اجرا شد» ثبت می‌شود" },
  { key: "rental_started", label: "شروع کرایه", hint: "وقتی تاریخ شروع کرایه ثبت می‌شود" },
  { key: "awaiting_payment", label: "در انتظار پرداخت", hint: "وقتی سفارش به مرحله پرداخت می‌رود" },
  { key: "paid", label: "ثبت پرداخت", hint: "هر بار که پرداختی برای سفارش ثبت می‌شود" },
  { key: "awaiting_collection", label: "درخواست جمع‌آوری", hint: "وقتی درخواست جمع‌آوری ثبت یا تایید می‌شود" },
  { key: "in_collection", label: "در حال جمع‌آوری", hint: "وقتی جمع‌آوری شروع می‌شود" },
  { key: "collected", label: "جمع‌آوری شد", hint: "وقتی جمع‌آوری تمام می‌شود" },
  { key: "completed", label: "اتمام سفارش", hint: "وقتی سفارش بسته می‌شود" },
];

export const CUSTOM_FRAME_STAGE_KEYS = CUSTOM_FRAME_STAGES.map((s) => s.key);
export const customFrameStageLabel = (key: string) =>
  CUSTOM_FRAME_STAGES.find((s) => s.key === key)?.label || key;

export type RecipientKind = "customer" | "collaborators" | "roles" | "phones";

export const RECIPIENT_KIND_LABELS: Record<RecipientKind, string> = {
  customer: "مشتری سفارش",
  collaborators: "همکاران سفارش",
  roles: "بخش‌های مدیریتی و پرسنل",
  phones: "شماره‌های دلخواه",
};

/** بخش‌هایی که می‌توان برایشان پیام فرستاد (همه کاربرانی که این نقش را دارند). */
export const RECIPIENT_ROLE_LABELS: Record<string, string> = {
  ceo: "مدیرعامل",
  general_manager: "مدیر کل",
  admin: "مدیر سیستم",
  scaffold_executive_manager: "مدیر اجرایی داربست",
  executive_manager_scaffold_execution_with_materials: "مدیر اجرایی داربست با اجناس",
  rental_executive_manager: "مدیر اجرایی کرایه اجناس",
  sales_manager: "مدیر فروش",
  finance_manager: "مدیر مالی",
  operations_manager: "مدیر عملیات",
  support_manager: "مدیر پشتیبانی",
  warehouse_manager: "مدیر انبار",
  security_manager: "مدیر حراست",
  scaffold_supervisor: "سرپرست داربست",
  scaffold_worker: "نیروی داربست",
  contractor: "پیمانکاران",
};

export const MAX_RECIPIENTS_PER_FRAME = 30;
export const MAX_CUSTOM_PHONES = 20;

export interface CustomFrame {
  id?: string;
  key: string;
  scope?: string | null;
  stage_key?: string | null;
  enabled: boolean;
  service_subcategory_ids?: string[] | null;
  excluded_subcategory_ids?: string[] | null;
  recipient_kinds?: string[] | null;
  recipient_roles?: string[] | null;
  recipient_phones?: string[] | null;
  conditions?: Record<string, unknown> | null;
}

export const normalizeIranMobile = (input?: string | null): string => {
  if (!input) return "";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  let raw = String(input)
    .slice(0, 32)
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[^0-9+]/g, "");
  if (raw.startsWith("0098")) raw = "0" + raw.slice(4);
  else if (raw.startsWith("098")) raw = "0" + raw.slice(3);
  else if (raw.startsWith("+98")) raw = "0" + raw.slice(3);
  else if (raw.startsWith("98")) raw = "0" + raw.slice(2);
  if (raw.length === 10 && raw.startsWith("9")) raw = "0" + raw;
  return /^09\d{9}$/.test(raw) ? raw : "";
};

/** شماره‌های دلخواه را از متن آزاد (هر خط یا جداشده با ویرگول) جدا و معتبرسازی می‌کند. */
export function parseCustomPhones(text: string): { valid: string[]; invalid: string[] } {
  const parts = String(text || "").split(/[\n,،;]+/).map((p) => p.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    const n = normalizeIranMobile(p);
    if (n) { if (!valid.includes(n)) valid.push(n); } else invalid.push(p);
  }
  return { valid: valid.slice(0, MAX_CUSTOM_PHONES), invalid };
}

export const frameStage = (f: CustomFrame) => f.stage_key || "";
export const frameKinds = (f: CustomFrame): RecipientKind[] =>
  (f.recipient_kinds || []).filter((k): k is RecipientKind => k in RECIPIENT_KIND_LABELS);

/** آیا این قاب برای سفارشی از این خدمت در این مرحله ارسال می‌شود؟ */
export function frameAppliesTo(f: CustomFrame, stage: string, subcategoryId?: string | null): boolean {
  if (!f.enabled || (f.scope && f.scope !== CUSTOM_FRAME_SCOPE) || frameStage(f) !== stage) return false;
  const targets = (f.service_subcategory_ids || []).filter(Boolean);
  if (targets.length > 0 && (!subcategoryId || !targets.includes(subcategoryId))) return false;
  if (subcategoryId && (f.excluded_subcategory_ids || []).includes(subcategoryId)) return false;
  return true;
}

/** اشکالات قاب قبل از ذخیره (پیام فارسی برای مدیر)؛ خالی یعنی قابل ذخیره است. */
export function validateCustomFrame(f: CustomFrame & { title?: string | null; template?: string | null }): string[] {
  const errors: string[] = [];
  if (!String(f.title || "").trim()) errors.push("عنوان قاب را وارد کنید");
  if (!CUSTOM_FRAME_STAGE_KEYS.includes(frameStage(f))) errors.push("مرحله سفارش را انتخاب کنید");
  if (!String(f.template || "").trim()) errors.push("متن پیام را بنویسید");
  const kinds = frameKinds(f);
  if (kinds.length === 0) errors.push("حداقل یک گیرنده انتخاب کنید");
  if (kinds.includes("roles") && (f.recipient_roles || []).filter((r) => r in RECIPIENT_ROLE_LABELS).length === 0)
    errors.push("بخش‌های مدیریتی گیرنده را انتخاب کنید");
  if (kinds.includes("phones") && (f.recipient_phones || []).filter((p) => normalizeIranMobile(p)).length === 0)
    errors.push("حداقل یک شماره موبایل معتبر وارد کنید");
  return errors;
}

export interface FrameRecipientContext {
  customerPhone?: string | null;
  /** مشتری پیامک را در تنظیمات خودش خاموش کرده است */
  customerSmsDisabled?: boolean;
  /** فراخوان خواسته به مشتری پیام نرود (مثلاً تغییر مرحله زمان‌بندی‌شده بدون اطلاع مشتری) */
  skipCustomer?: boolean;
  collaboratorPhones?: string[];
  rolePhones?: Record<string, string[]>;
}

export interface FrameRecipient {
  phone: string;
  audience: "customer" | "staff";
  kind: RecipientKind;
}

/** گیرندگان نهایی یک قاب: شماره‌های تکراری حذف می‌شوند و مشتری فقط با رضایت خودش پیام می‌گیرد. */
export function resolveFrameRecipients(f: CustomFrame, ctx: FrameRecipientContext): FrameRecipient[] {
  const out: FrameRecipient[] = [];
  const seen = new Set<string>();
  const customerPhone = normalizeIranMobile(ctx.customerPhone);
  const push = (raw: string | null | undefined, audience: FrameRecipient["audience"], kind: RecipientKind) => {
    const phone = normalizeIranMobile(raw);
    if (!phone || seen.has(phone)) return;
    // شماره مشتری فقط از مسیر «مشتری سفارش» و با رعایت رضایت او پیام می‌گیرد
    if (kind !== "customer" && phone === customerPhone) return;
    seen.add(phone);
    out.push({ phone, audience, kind });
  };
  const kinds = frameKinds(f);
  if (kinds.includes("customer") && !ctx.skipCustomer && !ctx.customerSmsDisabled) push(customerPhone, "customer", "customer");
  if (kinds.includes("collaborators")) (ctx.collaboratorPhones || []).forEach((p) => push(p, "customer", "collaborators"));
  if (kinds.includes("roles")) {
    for (const role of f.recipient_roles || []) {
      if (!(role in RECIPIENT_ROLE_LABELS)) continue;
      (ctx.rolePhones?.[role] || []).forEach((p) => push(p, "staff", "roles"));
    }
  }
  if (kinds.includes("phones")) (f.recipient_phones || []).slice(0, MAX_CUSTOM_PHONES).forEach((p) => push(p, "staff", "phones"));
  return out.slice(0, MAX_RECIPIENTS_PER_FRAME);
}

/** شرح کوتاه گیرندگان برای نمایش در فهرست قاب‌ها */
export function describeRecipients(f: CustomFrame): string[] {
  const kinds = frameKinds(f);
  const labels: string[] = [];
  if (kinds.includes("customer")) labels.push(RECIPIENT_KIND_LABELS.customer);
  if (kinds.includes("collaborators")) labels.push(RECIPIENT_KIND_LABELS.collaborators);
  if (kinds.includes("roles")) (f.recipient_roles || []).forEach((r) => RECIPIENT_ROLE_LABELS[r] && labels.push(RECIPIENT_ROLE_LABELS[r]));
  if (kinds.includes("phones")) {
    const n = (f.recipient_phones || []).length;
    if (n) labels.push(`${n.toLocaleString("fa-IR")} شماره دلخواه`);
  }
  return labels;
}

export const makeCustomFrameKey = (rand: string = Math.random().toString(36).slice(2, 10)) => `custom_${rand}`;
export const isCustomFrameKey = (key: unknown): key is string =>
  typeof key === "string" && /^custom_[a-z0-9]{4,16}$/.test(key);

/** کلید یکتای هر ارسال برای جلوگیری از پیام تکراری وقتی یک رویداد چند بار گزارش می‌شود */
export const dispatchClaimKey = (orderRef: string, stage: string, frameKey: string, phone: string) =>
  `${orderRef}|${stage}|${frameKey}|${phone}`;

/** پنجره جلوگیری از تکرار (ثانیه): همان رویداد برای همان گیرنده در این بازه فقط یک بار ارسال می‌شود */
export const DISPATCH_DEDUPE_SECONDS = 180;
