/**
 * بازه زمانی مجاز ارسال پیامک به مشتری (به وقت تهران)
 * تنظیمات در دیتابیس ذخیره می‌شود تا برای همه کاربران و سرور یکسان باشد.
 * اگر مدیر خارج از بازه وضعیت سفارشی را تغییر دهد، پیامک در صف قرار می‌گیرد
 * و در اولین لحظه بازه مجاز به مشتری ارسال می‌شود.
 */

import { supabase } from '@/integrations/supabase/client';
import { getIranMinutesOfDay } from './dateUtils';

export interface SmsSendWindow {
  enabled: boolean;
  /** شروع بازه به شکل HH:MM (وقت تهران، ۲۴ ساعته) */
  start: string;
  /** پایان بازه به شکل HH:MM (وقت تهران، ۲۴ ساعته) */
  end: string;
}

const STORAGE_KEY = 'sms_send_window_v1';

export const DEFAULT_SMS_SEND_WINDOW: SmsSendWindow = {
  enabled: false,
  start: '09:00',
  end: '21:00',
};

const isValidTime = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

const normalize = (win: Partial<SmsSendWindow> | null | undefined): SmsSendWindow => ({
  enabled: !!win?.enabled,
  start: isValidTime(win?.start) ? (win!.start as string) : DEFAULT_SMS_SEND_WINDOW.start,
  end: isValidTime(win?.end) ? (win!.end as string) : DEFAULT_SMS_SEND_WINDOW.end,
});

/** آخرین مقدار شناخته‌شده (کش محلی) برای استفاده همزمان */
export const getSmsSendWindow = (): SmsSendWindow => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SMS_SEND_WINDOW };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SMS_SEND_WINDOW };
  }
};

const cacheLocally = (win: SmsSendWindow) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(win));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('sms-send-window-changed', { detail: win }));
  } catch {}
};

/** خواندن تنظیمات از دیتابیس (منبع اصلی) */
export const fetchSmsSendWindow = async (): Promise<SmsSendWindow> => {
  try {
    const { data, error } = await supabase
      .from('sms_send_window')
      .select('enabled, start_time, end_time')
      .maybeSingle();
    if (error || !data) return getSmsSendWindow();
    const win = normalize({
      enabled: (data as any).enabled,
      start: (data as any).start_time,
      end: (data as any).end_time,
    });
    cacheLocally(win);
    return win;
  } catch {
    return getSmsSendWindow();
  }
};

/** ذخیره تنظیمات در دیتابیس */
export const saveSmsSendWindow = async (
  win: SmsSendWindow
): Promise<{ win: SmsSendWindow; error?: string }> => {
  const safe = normalize(win);
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from('sms_send_window').upsert(
      {
        id: true,
        enabled: safe.enabled,
        start_time: safe.start,
        end_time: safe.end,
        updated_at: new Date().toISOString(),
        updated_by: userRes?.user?.id ?? null,
      } as any,
      { onConflict: 'id' }
    );
    if (error) return { win: safe, error: error.message };
    cacheLocally(safe);
    return { win: safe };
  } catch (e) {
    return { win: safe, error: e instanceof Error ? e.message : String(e) };
  }
};

/** سازگاری با نسخه قبلی (فقط کش محلی) */
export const setSmsSendWindow = (win: SmsSendWindow) => {
  const safe = normalize(win);
  cacheLocally(safe);
  return safe;
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
};

export const isInsideSmsWindow = (win: SmsSendWindow): boolean => {
  if (!win.enabled) return true;
  const start = toMinutes(win.start);
  const end = toMinutes(win.end);
  if (start === end) return true; // بازه ۲۴ ساعته
  const cur = getIranMinutesOfDay(new Date());
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
};

/**
 * اگر همین حالا داخل بازه مجاز هستیم null برمی‌گردد (یعنی فوری ارسال شود).
 * در غیر این صورت زمان (UTC) اولین لحظه مجاز برای ارسال برگردانده می‌شود.
 */
export const getNextAllowedSendTime = (win: SmsSendWindow = getSmsSendWindow()): Date | null => {
  if (!win.enabled) return null;

  const start = toMinutes(win.start);
  const end = toMinutes(win.end);
  if (start === end) return null; // بازه ۲۴ ساعته

  if (isInsideSmsWindow(win)) return null;

  const cur = getIranMinutesOfDay(new Date());
  const waitMinutes = cur < start ? start - cur : 1440 - cur + start;
  return new Date(Date.now() + waitMinutes * 60 * 1000);
};

/** نسخه معتبر (با خواندن مقدار به‌روز از دیتابیس) */
export const getNextAllowedSendTimeFresh = async (): Promise<Date | null> => {
  const win = await fetchSmsSendWindow();
  return getNextAllowedSendTime(win);
};

export const formatSmsWindowLabel = (win: SmsSendWindow = getSmsSendWindow()) =>
  win.enabled ? `${win.start} تا ${win.end}` : 'بدون محدودیت';
