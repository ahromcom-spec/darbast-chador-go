import { parsePersianNumber } from '@/lib/numberParsing';

/**
 * اضافه‌کاری / کم‌کاری بر حسب ساعت اعشاری ذخیره می‌شود (مثلاً 1.5 = 01:30، -0.5 = -00:30)
 * ورودی کاربر می‌تواند "1:30" یا "-0:30" یا "1.5" باشد.
 */
export const parseOvertimeInput = (input: string): number => {
  const raw = String(parsePersianNumber(String(input ?? '')) ?? '').trim();
  if (!raw || raw === '-' || raw === ':' || raw === '-:') return 0;

  const isNeg = raw.startsWith('-');
  const body = (isNeg ? raw.slice(1) : raw).replace(/[^\d:.]/g, '');

  let hours = 0;
  if (body.includes(':')) {
    const [h, m] = body.split(':');
    hours = (parseInt(h || '0', 10) || 0) + (parseInt((m || '0').slice(0, 2), 10) || 0) / 60;
  } else {
    hours = parseFloat(body) || 0;
  }
  const signed = (isNeg ? -1 : 1) * hours;
  // گرد کردن به نزدیک‌ترین دقیقه
  return Math.round(signed * 60) / 60;
};

/** خروجی "HH:MM" با علامت منفی برای کم‌کاری */
export const formatOvertime = (hours: number | null | undefined): string => {
  const value = Number(hours) || 0;
  const sign = value < 0 ? '-' : '';
  const totalMinutes = Math.round(Math.abs(value) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** برچسب فارسی: «2:30 ساعت اضافه‌کاری» یا «0:40 کم‌کاری» */
export const formatOvertimeLabel = (hours: number | null | undefined): string => {
  const value = Number(hours) || 0;
  if (value === 0) return '—';
  const text = formatOvertime(Math.abs(value));
  return value > 0 ? `${text} اضافه‌کاری` : `${text} کم‌کاری`;
};
