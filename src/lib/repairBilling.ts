/**
 * وضعیت‌هایی از درخواست تعمیر که هزینه‌شان در مبلغ کل سفارش و صورتحساب حساب می‌شود.
 * باید با تابع recompute_projects_v3_total_price در دیتابیس هماهنگ باشد.
 */
export const BILLABLE_REPAIR_STATUSES = ['approved', 'awaiting_repair', 'repaired', 'completed', 'paid'] as const;

export const isBillableRepair = (r: { status?: string | null } | null | undefined): boolean =>
  !!r && BILLABLE_REPAIR_STATUSES.includes((r.status || '') as any);

export const repairCost = (r: { final_cost?: number | null; estimated_cost?: number | null }): number =>
  Number(r.final_cost ?? r.estimated_cost ?? 0) || 0;
