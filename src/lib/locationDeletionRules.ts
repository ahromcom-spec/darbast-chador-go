export interface LocationOrderRow {
  id: string;
  status: string | null;
  is_archived?: boolean | null;
}

/**
 * فقط سفارش‌های «در انتظار تایید» که بایگانی نشده‌اند همراه آدرس حذف می‌شوند؛
 * هر سفارش دیگری (تاییدشده، بایگانی‌شده، پرداخت‌شده و ...) مانع حذف آدرس است.
 */
export const partitionLocationOrders = (orders: LocationOrderRow[]) => {
  const removable: string[] = [];
  const blocking: string[] = [];
  for (const o of orders) {
    if (o.status === 'pending' && !o.is_archived) removable.push(o.id);
    else blocking.push(o.id);
  }
  return { removable, blocking };
};
