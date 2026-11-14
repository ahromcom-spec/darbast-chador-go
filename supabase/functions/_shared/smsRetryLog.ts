// یک پیامک = یک ردیف در گزارش ارسال، حتی با چند تلاش ناموفق خودکار یا ارسال مجدد دستی.
export interface SmsLogRef {
  id: string;
  recipient: string;
  status: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSmsLogId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** فقط ردیف ناموفقِ همان گیرنده برای تلاش بعدی به‌روزرسانی می‌شود؛ پیام موفق هرگز بازنویسی نمی‌شود. */
export const canReuseSmsLog = (existing: SmsLogRef | null | undefined, recipient: string): boolean =>
  !!existing && existing.status === "failed" && existing.recipient === recipient;
