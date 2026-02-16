/**
 * محاسبه متراژ/حجم کل از ابعاد - همیشه از ابعاد ذخیره شده محاسبه مجدد می‌کند
 * برای جلوگیری از مقادیر اشتباه ذخیره شده قبلی
 */

import { parseLocalizedNumber } from './numberParsing';

export interface DimensionInput {
  length?: string | number;
  width?: string | number;
  height?: string | number;
  l?: string | number;
  w?: string | number;
  h?: string | number;
  L?: string | number;
  W?: string | number;
  H?: string | number;
  unitCount?: number;
}

/**
 * محاسبه حجم/مساحت کل از آرایه ابعاد
 * اگر عرض وجود داشته باشد: طول × عرض × ارتفاع (متر مکعب)
 * اگر عرض وجود نداشته باشد: طول × ارتفاع (متر مربع - برای نما)
 */
export function calculateTotalFromDimensions(
  dimensions: DimensionInput[] | undefined | null,
  columnHeight?: number | string | null
): { total: number; unit: string; isVolume: boolean } {
  if (!dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
    return { total: 0, unit: 'متر مکعب', isVolume: true };
  }

  const hasAnyWidth = dimensions.some((d) => {
    const w = parseLocalizedNumber(String(d.width ?? d.w ?? d.W ?? ''));
    return w > 0;
  });

  const total = dimensions.reduce((sum, dim) => {
    const length = parseLocalizedNumber(String(dim.length ?? dim.l ?? dim.L ?? ''));
    const width = parseLocalizedNumber(String(dim.width ?? dim.w ?? dim.W ?? ''));
    const height = parseLocalizedNumber(String(dim.height ?? dim.h ?? dim.H ?? ''));
    const actualHeight = columnHeight ? parseLocalizedNumber(String(columnHeight)) || height : height;

    if (hasAnyWidth) {
      return sum + (length * (width || 1) * actualHeight);
    }
    return sum + (length * actualHeight);
  }, 0);

  return {
    total,
    unit: hasAnyWidth ? 'متر مکعب' : 'متر مربع',
    isVolume: hasAnyWidth,
  };
}

/**
 * محاسبه حجم/مساحت از notes سفارش - همیشه recalculate می‌کند
 */
export function calculateTotalFromNotes(notes: any): { total: number; unit: string; isVolume: boolean } {
  if (!notes) return { total: 0, unit: 'متر مکعب', isVolume: true };
  const parsed = typeof notes === 'string' ? JSON.parse(notes) : notes;
  return calculateTotalFromDimensions(parsed?.dimensions, parsed?.columnHeight);
}
