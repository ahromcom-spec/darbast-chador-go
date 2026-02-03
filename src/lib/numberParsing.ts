/**
 * Locale-aware number parsing.
 * Handles Persian/Arabic digits and common thousand/decimal separators.
 */

export function toEnglishDigits(input: string): string {
  return input
    // Persian digits
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    // Arabic-Indic digits
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function parseLocalizedNumber(value: unknown, useCommaDecimal?: boolean): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let str = String(value).trim();
  if (!str) return 0;

  str = toEnglishDigits(str);

  // Remove currency symbols and whitespace
  str = str.replace(/\s/g, '');
  str = str.replace(/[¤$€£¥]/g, '');

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  const isCommaDecimal = useCommaDecimal ?? (lastComma > lastDot);

  if (isCommaDecimal) {
    // 1.234,56 => 1234.56
    str = str.replace(/\./g, '');
    str = str.replace(',', '.');
  } else {
    // 1,234.56 => 1234.56
    str = str.replace(/,/g, '');
  }

  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
}
