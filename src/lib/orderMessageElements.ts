// المان‌های قابل درج در پیام دستی سفارش (بدون وابستگی به سرور تا در آزمون‌ها هم قابل استفاده باشد)

/** المان‌های سفارش که مدیر می‌تواند داخل متن پیام بگذارد (سرور آن‌ها را با داده همان سفارش پر می‌کند). */
export const ORDER_MESSAGE_ELEMENTS: { token: string; label: string }[] = [
  { token: '{نام_مشتری}', label: 'نام مشتری' },
  { token: '{کد}', label: 'کد سفارش' },
  { token: '{نوع_خدمات}', label: 'نوع خدمات و زیرشاخه' },
  { token: '{آدرس}', label: 'آدرس' },
  { token: '{مبلغ}', label: 'مبلغ سفارش' },
  { token: '{مجموع_پرداخت_شده}', label: 'مجموع پرداخت‌شده' },
  { token: '{مانده_سفارش}', label: 'مانده سفارش' },
  { token: '{مبلغ_پرداخت}', label: 'مبلغ آخرین پرداخت' },
  { token: '{تاریخ_واریز}', label: 'تاریخ واریز آخرین پرداخت' },
  { token: '{تاریخ_شروع_کرایه}', label: 'تاریخ شروع کرایه' },
  { token: '{تاریخ_اجرا}', label: 'تاریخ اجرا' },
  { token: '{تاریخ_جمع_آوری}', label: 'تاریخ جمع‌آوری' },
  { token: '{تاریخ_اتمام}', label: 'تاریخ اتمام' },
  { token: '{شرح_فعالیت}', label: 'شرح فعالیت سفارش' },
  { token: '{لینک_سفارش}', label: 'لینک سفارش' },
  { token: '{لینک_پرداخت}', label: 'لینک پرداخت' },
  { token: '{تاریخ_و_ساعت}', label: 'تاریخ و ساعت امروز' },
];

/** درج المان در محل نشانگر متن؛ اگر کنار حرف دیگری بیفتد با فاصله جدا می‌شود. */
export function insertElementAt(text: string, token: string, start: number, end: number = start): { text: string; cursor: number } {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  const before = text.slice(0, s);
  const after = text.slice(e);
  const pre = before && !/\s$/.test(before) ? ' ' : '';
  const post = after && !/^\s/.test(after) ? ' ' : '';
  const inserted = `${pre}${token}${post}`;
  return { text: before + inserted + after, cursor: before.length + pre.length + token.length };
}

