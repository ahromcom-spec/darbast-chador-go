import { format as formatJalali } from 'date-fns-jalali';

const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

// Iran timezone (Asia/Tehran) — UTC+3:30, no DST
const IRAN_TIME_ZONE = 'Asia/Tehran';
const IRAN_TIMEZONE_OFFSET_MINUTES = 210;

let iranPartsFormatter: Intl.DateTimeFormat | null = null;
const getIranPartsFormatter = () => {
  if (!iranPartsFormatter) {
    iranPartsFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: IRAN_TIME_ZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return iranPartsFormatter;
};

/**
 * Convert a date to Iran timezone (Asia/Tehran).
 * Returns a Date whose *local* fields (getHours/getDate/...) represent Tehran wall-clock time,
 * regardless of the device/server timezone.
 */
export function toIranTime(date: Date | string | null | undefined): Date | null {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
    if (isNaN(dateObj.getTime())) return null;

    try {
      const parts = getIranPartsFormatter().formatToParts(dateObj);
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
      const year = get('year');
      const month = get('month');
      const day = get('day');
      let hour = get('hour');
      const minute = get('minute');
      const second = get('second');
      if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) throw new Error('bad parts');
      if (hour === 24) hour = 0;
      return new Date(year, month - 1, day, hour, minute, second);
    } catch {
      // Fallback: fixed UTC+3:30 offset
      const utcTime = dateObj.getTime() + dateObj.getTimezoneOffset() * 60 * 1000;
      return new Date(utcTime + IRAN_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
    }
  } catch (error) {
    console.error('Error converting to Iran time:', error);
    return null;
  }
}

/**
 * Minutes since midnight (Tehran wall clock) for a given instant
 */
export function getIranMinutesOfDay(date: Date | string | null | undefined = new Date()): number {
  const iran = toIranTime(date) || new Date();
  return iran.getHours() * 60 + iran.getMinutes();
}


/**
 * Get current date/time in Iran timezone
 */
export function getIranNow(): Date {
  return toIranTime(new Date()) || new Date();
}

/**
 * Get today's date string in Iran timezone (YYYY-MM-DD format)
 */
export function getIranToday(): string {
  const iranNow = getIranNow();
  const year = iranNow.getFullYear();
  const month = String(iranNow.getMonth() + 1).padStart(2, '0');
  const day = String(iranNow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date to Persian (Jalali) format with optional day of week and time
 * All dates are automatically converted to Iran timezone (UTC+3:30)
 */
export function formatPersianDate(
  date: Date | string | null | undefined,
  options: {
    showDayOfWeek?: boolean;
    showTime?: boolean;
    dateFormat?: string;
  } = {}
): string {
  if (!date) return '-';
  
  const {
    showDayOfWeek = false,
    showTime = false,
    dateFormat = 'yyyy/MM/dd'
  } = options;

  try {
    // Convert to Iran timezone
    const iranDate = toIranTime(date);
    if (!iranDate) return '-';
    
    let result = '';
    
    // Add day of week
    if (showDayOfWeek) {
      const dayIndex = iranDate.getDay();
      result += `${persianDays[dayIndex]} `;
    }
    
    // Add date
    result += formatJalali(iranDate, dateFormat);
    
    // Add time
    if (showTime) {
      const hours = iranDate.getHours().toString().padStart(2, '0');
      const minutes = iranDate.getMinutes().toString().padStart(2, '0');
      result += ` ساعت ${hours}:${minutes}`;
    }
    
    return result;
  } catch (error) {
    console.error('Error formatting Persian date:', error);
    return '-';
  }
}

/**
 * Format a date to Persian long format (e.g., "جمعه 15 دی 1403")
 */
export function formatPersianDateLong(date: Date | string | null | undefined): string {
  return formatPersianDate(date, { showDayOfWeek: true, dateFormat: 'd MMMM yyyy' });
}

/**
 * Format a date to Persian with time (e.g., "1403/10/15 ساعت 14:30")
 */
export function formatPersianDateTime(date: Date | string | null | undefined): string {
  return formatPersianDate(date, { showTime: true });
}

/**
 * Format a date to Persian with day of week and time (e.g., "جمعه 1403/10/15 ساعت 14:30")
 */
export function formatPersianDateTimeFull(date: Date | string | null | undefined): string {
  return formatPersianDate(date, { showDayOfWeek: true, showTime: true });
}

/**
 * Format time only in Iran timezone (e.g., "14:30")
 */
export function formatIranTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  
  try {
    const iranDate = toIranTime(date);
    if (!iranDate) return '-';
    
    const hours = iranDate.getHours().toString().padStart(2, '0');
    const minutes = iranDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting Iran time:', error);
    return '-';
  }
}

/**
 * Tehran calendar date (YYYY-MM-DD) of an instant — use for report_date columns
 * so late-night payments (e.g. 03:00 Tehran) don't land on the previous UTC day.
 */
export function toIranDateString(date: Date | string | null | undefined): string | null {
  const d = toIranTime(date);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
