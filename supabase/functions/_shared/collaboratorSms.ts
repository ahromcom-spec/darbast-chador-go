// پیامک همکاران سفارش: مدیریت برای هر همکار سفارش کلید روشن/خاموش پیامک دارد.
// همکارِ روشن با هر تغییر مرحله سفارش، همان پیام مرحله‌ای را که مشتری می‌گیرد دریافت می‌کند
// و در قاب‌های پیام سفارشی با گیرنده «همکاران سفارش» هم فقط همکاران روشن پیام می‌گیرند.
// این فایل بین سرور (ارسال) و آزمون‌ها مشترک است.

import { normalizeIranMobile } from "./smsCustomFrames.ts";

/** مراحل اصلی سفارش که نسخه پیامشان برای همکاران روشن هم فرستاده می‌شود (رویدادهای تمدید/تعمیر/انتقال جدا هستند). */
export const COLLABORATOR_COPY_STAGES = [
  "approved", "rejected", "in_progress", "executed", "rental_started", "awaiting_payment", "paid",
  "awaiting_collection", "in_collection", "collected", "completed",
] as const;

export const isCollaboratorCopyStage = (stage: string | null | undefined): boolean =>
  !!stage && (COLLABORATOR_COPY_STAGES as readonly string[]).includes(stage);

export interface CollaboratorSmsRow {
  phone?: string | null;
  sms_enabled?: boolean | null;
  /** همکار پیامک‌ها را در حساب خودش خاموش کرده است */
  sms_opted_out?: boolean | null;
}

/** شماره همکارانی که باید پیام بگیرند: فقط کلید روشن، بدون انصراف خودشان، بدون تکرار و جدا از شماره مشتری. */
export function enabledCollaboratorPhones(rows: CollaboratorSmsRow[], customerPhone?: string | null): string[] {
  const customer = normalizeIranMobile(customerPhone);
  const out: string[] = [];
  for (const r of rows || []) {
    if (r?.sms_enabled !== true || r?.sms_opted_out === true) continue;
    const p = normalizeIranMobile(r.phone);
    if (!p || p === customer || out.includes(p)) continue;
    out.push(p);
  }
  return out;
}

/** کلید جلوگیری از تکرار نسخه همکار برای یک مرحله */
export const COLLABORATOR_COPY_FRAME_KEY = "collaborator_copy";
