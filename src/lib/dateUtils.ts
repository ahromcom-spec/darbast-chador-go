import { format as formatJalali } from 'date-fns-jalali';

const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

// Iran timezone offset: UTC+3:30 (210 minutes)
const IRAN_TIMEZONE_OFFSET_MINUTES = 210;

/**
 * Convert a date to Iran timezone (UTC+3:30)
 */
export function toIranTime(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
    
    // Get the UTC time in milliseconds
    const utcTime = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60 * 1000);
    
    // Add Iran timezone offset (UTC+3:30 = 210 minutes)
    const iranTime = new Date(utcTime + (IRAN_TIMEZONE_OFFSET_MINUTES * 60 * 1000));
    
    return iranTime;
  } catch (error) {
    console.error('Error converting to Iran time:', error);
    return null;
  }
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
