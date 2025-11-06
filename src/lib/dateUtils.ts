import { format as formatJalali } from 'date-fns-jalali';

const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

/**
 * Format a date to Persian (Jalali) format with optional day of week and time
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
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    let result = '';
    
    // Add day of week
    if (showDayOfWeek) {
      const dayIndex = dateObj.getDay();
      result += `${persianDays[dayIndex]} `;
    }
    
    // Add date
    result += formatJalali(dateObj, dateFormat);
    
    // Add time
    if (showTime) {
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
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
