/**
 * وقتی مرحله سفارش به «اجرا شد» می‌رود و تاریخ اجرا وارد می‌شود،
 * همان تاریخ شروع کرایه داربست هم می‌شود (به‌جز داربست بدون اجناس که کرایه ندارد).
 */
export function rentalStartFromExecution(
  newStage: string,
  executionDateIso: string | null | undefined,
  isNoMaterials: boolean,
): string | null {
  if (newStage !== 'order_executed') return null;
  if (isNoMaterials) return null;
  const value = (executionDateIso || '').trim();
  return value ? value : null;
}
