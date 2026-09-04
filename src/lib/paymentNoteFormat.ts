/**
 * ساخت و نمایش توضیحات پرداخت‌های سفارش.
 * هدف: کاربر در تاریخچه پرداخت‌های سفارش دقیقاً بفهمد این مبلغ بخشی از کدام واریز کل
 * (با مبلغ و تاریخ) بوده است.
 */

import { formatPersianDate } from '@/lib/dateUtils';

const fmtAmount = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(Number(n) || 0));

/** تگ‌های فنی داخل توضیحات که نباید به کاربر نشان داده شوند */
const INTERNAL_TAGS = /\s*\[(?:STMT-GRP|CHEQUE|SUB|GRP):[^\]]*\]/g;

/** نمایش تمیز توضیحات پرداخت (بدون تگ‌های فنی) */
export function displayPaymentNote(notes?: string | null): string {
  if (!notes) return '';
  return notes.replace(INTERNAL_TAGS, '').replace(/\s{2,}/g, ' ').trim();
}

export interface GroupPaymentContext {
  /** مبلغ کل واریزی که این پرداخت بخشی از آن است */
  totalAmount: number;
  /** تاریخ واریز (ISO) */
  date?: string | null;
  /** مبلغ تخصیص‌یافته به همین سفارش */
  portion?: number;
  /** شماره صورتحساب مرتبط (اختیاری) */
  statementNumber?: number | string | null;
  /** روش پرداخت برای متن خواناتر */
  method?: 'cheque' | 'card' | 'cash';
}

/**
 * جمله‌ی خوانا برای توضیح پرداخت سفارش:
 * «این مبلغ بخشی از واریز کل ۵۰٬۰۰۰٬۰۰۰ تومان در تاریخ ۱۴۰۵/۰۶/۱۳ است»
 */
export function buildGroupPaymentSummary({
  totalAmount, date, portion, statementNumber, method,
}: GroupPaymentContext): string {
  const dateText = date ? formatPersianDate(date, { dateFormat: 'yyyy/MM/dd' }) : '';
  const kindText = method === 'cheque' ? 'چک' : method === 'cash' ? 'پرداخت نقدی' : 'واریز';
  const stmtText = statementNumber ? ` (صورتحساب ${statementNumber})` : '';
  const isPartial = portion != null && Math.round(portion) < Math.round(totalAmount);
  const head = isPartial
    ? `این مبلغ (${fmtAmount(portion!)} تومان) بخشی از ${kindText} کل ${fmtAmount(totalAmount)} تومان`
    : `${kindText} ${fmtAmount(totalAmount)} تومان`;
  return `${head}${dateText ? ` در تاریخ ${dateText}` : ''}${stmtText} است`;
}

/** حذف جمله‌ی خلاصه از انتهای توضیحات (برای جلوگیری از تکرار در ویرایش) */
export function stripGroupPaymentSummary(notes?: string | null): string {
  if (!notes) return '';
  return notes
    .replace(/\s*—\s*(?:این مبلغ|واریز|چک|پرداخت نقدی)[^—]*?است\s*$/u, '')
    .trim();
}
