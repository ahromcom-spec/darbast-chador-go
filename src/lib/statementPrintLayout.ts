import { formatPersianDate } from '@/lib/dateUtils';

/** Only numeric formatted dates are interpolated into the statement HTML. */
export function compactStatementDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = formatPersianDate(value);
  const parts = date.match(/^([0-9۰-۹٠-٩]{4})\/([0-9۰-۹٠-٩]{1,2})\/([0-9۰-۹٠-٩]{1,2})$/);
  if (!parts) return '-';
  return `<span class="statement-date" dir="ltr"><span>${parts[1]}</span><span>${parts[2]}/${parts[3]}</span></span>`;
}

/** Shared by preview, browser print and PDF; no financial values are changed. */
export const statementPrintLayout = `
  .orders-table { table-layout: fixed; }
  .orders-table th, .orders-table td { padding: 5px 3px; vertical-align: middle; }
  .orders-table th { font-size: 11px; line-height: 1.45; }
  .orders-table td { font-size: 11.5px; }
  .orders-table .date-heading { font-size: 10px; white-space: normal; }
  .orders-table .amount-heading { white-space: normal; }
  .orders-table .amount-heading small { display: block; font-size: 9px; font-weight: normal; }
  .orders-table .description-cell { text-align: right; font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; word-break: normal; }
  .orders-table .code-cell { font-size: 10.5px; }
  .orders-table thead { display: table-header-group; }
  .orders-table tr { break-inside: avoid; page-break-inside: avoid; }
  .statement-date { display: inline-flex; flex-direction: column; align-items: center; font-size: 11px; line-height: 1.4; white-space: nowrap; font-variant-numeric: tabular-nums; }
`;