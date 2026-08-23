/**
 * بازه زمانی مجاز ارسال پیامک به مشتری
 * اگر مدیر نصف شب وضعیت سفارشی را تغییر دهد، پیامک در صف قرار می‌گیرد
 * و در اولین لحظه بازه مجاز (به وقت ایران) به مشتری ارسال می‌شود.
 */

import { getIranNow } from './dateUtils';

export interface SmsSendWindow {
  enabled: boolean;
  /** شروع بازه به شکل HH:MM (وقت ایران) */
  start: string;
  /** پایان بازه به شکل HH:MM (وقت ایران) */
  end: string;
}

const STORAGE_KEY = 'sms_send_window_v1';

export const DEFAULT_SMS_SEND_WINDOW: SmsSendWindow = {
  enabled: false,
  start: '09:00',
  end: '21:00',
};

const isValidTime = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export const getSmsSendWindow = (): SmsSendWindow => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SMS_SEND_WINDOW };
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed?.enabled,
      start: isValidTime(parsed?.start) ? parsed.start : DEFAULT_SMS_SEND_WINDOW.start,
      end: isValidTime(parsed?.end) ? parsed.end : DEFAULT_SMS_SEND_WINDOW.end,
    };
  } catch {
    return { ...DEFAULT_SMS_SEND_WINDOW };
  }
};

export const setSmsSendWindow = (win: SmsSendWindow) => {
  const safe: SmsSendWindow = {
    enabled: !!win.enabled,
    start: isValidTime(win.start) ? win.start : DEFAULT_SMS_SEND_WINDOW.start,
    end: isValidTime(win.end) ? win.end : DEFAULT_SMS_SEND_WINDOW.end,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('sms-send-window-changed', { detail: safe }));
  } catch {}
  return safe;
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
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

  const iranNow = getIranNow();
  const cur = iranNow.getHours() * 60 + iranNow.getMinutes();

  const inside =
    start < end ? cur >= start && cur < end : cur >= start || cur < end;

  if (inside) return null;

  const waitMinutes = cur < start ? start - cur : 1440 - cur + start;
  return new Date(Date.now() + waitMinutes * 60 * 1000);
};

export const formatSmsWindowLabel = (win: SmsSendWindow = getSmsSendWindow()) =>
  win.enabled ? `${win.start} تا ${win.end}` : 'بدون محدودیت';
