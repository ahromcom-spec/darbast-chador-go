// المان‌های قابل درج در پیام دستی سفارش (بدون وابستگی به سرور تا در آزمون‌ها هم قابل استفاده باشد)

/** المان‌های سفارش که مدیر می‌تواند داخل متن پیام بگذارد (سرور آن‌ها را با داده همان سفارش پر می‌کند). */
export const ORDER_MESSAGE_ELEMENTS: { token: string; label: string }[] = [
  { token: '{customerName}', label: 'نام مشتری' },
  { token: '{code}', label: 'کد سفارش' },
  { token: '{serviceType}', label: 'نوع خدمت' },
  { token: '{address}', label: 'آدرس' },
  { token: '{amount}', label: 'مبلغ سفارش' },
  { token: '{totalPaid}', label: 'مجموع پرداخت‌شده' },
  { token: '{remainingAmount}', label: 'مانده سفارش' },
  { token: '{paidAmount}', label: 'مبلغ آخرین پرداخت' },
  { token: '{paymentDate}', label: 'تاریخ واریز آخرین پرداخت' },
  { token: '{rentalStartDate}', label: 'تاریخ شروع کرایه' },
  { token: '{executionDate}', label: 'تاریخ اجرا' },
  { token: '{collectionDate}', label: 'تاریخ جمع‌آوری' },
  { token: '{completionDate}', label: 'تاریخ اتمام' },
  { token: '{description}', label: 'شرح فعالیت سفارش' },
  { token: '{orderLink}', label: 'لینک سفارش' },
  { token: '{paymentLink}', label: 'لینک پرداخت' },
  { token: '{dateTime}', label: 'تاریخ و ساعت امروز' },
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

