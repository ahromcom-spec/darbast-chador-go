/**
 * Cooperation rank → discount percent mapping.
 * 1 → 0% (بدون تخفیف), 2 → ~0.75%, ... 10 → 6% (خطی بین 2 و 10).
 */
export const rankToDiscountPercent = (rank: number | null | undefined): number => {
  const r = Math.max(1, Math.min(10, Math.round(Number(rank) || 1)));
  if (r <= 1) return 0;
  // 1.5× of previous mapping: rank 10 → 9% (was 6%). Linear 1..10 → 0..9.
  return Math.round(((r - 1) * 9 / 9) * 100) / 100;
};


/** گرد کردن به نزدیک‌ترین هزار تومان */
export const roundToThousand = (n: number): number => {
  if (!isFinite(n)) return 0;
  return Math.round(n / 1000) * 1000;
};

/** اعمال درصد تخفیف و گرد کردن به ۱۰۰۰ تومان */
export const applyDiscountAndRound = (amount: number, discountPct: number): number => {
  const after = amount * (1 - (discountPct || 0) / 100);
  return roundToThousand(after);
};
