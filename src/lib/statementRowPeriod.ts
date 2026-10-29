import type { BillingCharge } from '@/lib/orderChargeBilling';

const ORDINALS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم', 'یازدهم', 'دوازدهم'];
export const persianOrdinal = (n: number) => ORDINALS[n - 1] ?? `${new Intl.NumberFormat('fa-IR').format(n)}م`;

export type RowPeriod = { label: string; start: string | null; end: string | null };

const DAY = 24 * 60 * 60 * 1000;

/**
 * Describes which rental months / repairs a statement row bills for.
 * `hasBaseMonth` is true when the order itself charges its first month (not a separated order).
 */
export function describeRowPeriod(
  charges: BillingCharge[],
  opts: { hasBaseMonth: boolean; rentalStart?: string | null; rentalEnd?: string | null },
): RowPeriod {
  const renewals = charges.filter(c => c.kind === 'renewal');
  const repairs = charges.filter(c => c.kind === 'repair');
  const months: number[] = [];
  const starts: string[] = [];
  const ends: string[] = [];

  if (opts.hasBaseMonth) {
    months.push(1);
    if (opts.rentalStart) {
      starts.push(opts.rentalStart);
      const firstRenewalStart = renewals.map(r => r.start).filter(Boolean).sort()[0];
      ends.push(firstRenewalStart || (renewals.length === 0 && opts.rentalEnd) || new Date(new Date(opts.rentalStart).getTime() + 30 * DAY).toISOString());
    }
  }
  for (const r of renewals) {
    const m = Number((r as any).monthNumber);
    if (m > 0) months.push(m);
    if (r.start) starts.push(r.start);
    if (r.end) ends.push(r.end);
  }

  const parts: string[] = [];
  const uniq = [...new Set(months)].sort((a, b) => a - b);
  if (uniq.length) parts.push(uniq.map(m => `ماه ${persianOrdinal(m)}`).join(' و '));
  if (repairs.length) parts.push(repairs.length > 1 ? `تعمیرات (${new Intl.NumberFormat('fa-IR').format(repairs.length)} مورد)` : 'تعمیرات');

  return {
    label: parts.join(' + '),
    start: starts.sort()[0] ?? null,
    end: ends.sort().at(-1) ?? null,
  };
}
