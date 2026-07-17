/**
 * Adjust an order's stored price breakdown so it reflects a manually-applied
 * fixed price (e.g. when a manager overrides the auto-calculated total).
 *
 * - Replaces the numeric value inside any "مجموع ... ماه:" line with the fixed price.
 * - Appends a clarifying line when the fixed price differs from what the original
 *   breakdown summed to, so the customer/manager sees the agreed final amount.
 */

const toEnglishDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

const parseAmount = (text: string): number | null => {
  const en = toEnglishDigits(text).replace(/[,،\s]/g, '');
  const m = en.match(/(\d+)\s*تومان/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};

export function applyFixedPriceToBreakdown(
  breakdown: string[] | undefined | null,
  fixedPrice: number | null | undefined,
): string[] {
  const items = Array.isArray(breakdown) ? [...breakdown] : [];
  if (!fixedPrice || fixedPrice <= 0) return items;

  let replacedSum = false;
  let originalSum: number | null = null;

  for (let i = 0; i < items.length; i++) {
    const line = items[i];
    if (typeof line !== 'string') continue;
    // Match "مجموع ... ماه:" lines that carry a numeric value
    if (line.includes('مجموع') && /تومان/.test(line)) {
      const amount = parseAmount(line);
      if (amount !== null) {
        originalSum = amount;
        items[i] = line.replace(
          /([۰-۹0-9٠-٩,،\s]+)\s*تومان/,
          `${fixedPrice.toLocaleString('fa-IR')} تومان`,
        );
        replacedSum = true;
      }
    }
  }

  if (originalSum === null || originalSum !== fixedPrice) {
    items.push(
      `قیمت نهایی اعمال‌شده: ${fixedPrice.toLocaleString('fa-IR')} تومان`,
    );
  }

  return items;
}
