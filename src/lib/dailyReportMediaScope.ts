const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A row index is canonical within a report. Saved IDs recover only legacy
// records without an index; aggregated rows use their source row ID instead.
export function dailyReportMediaScope(rowIndex: number, rowId?: string, sourceRow = false): string {
  const validRowId = rowId && UUID_REGEX.test(rowId) ? rowId : undefined;
  if (sourceRow && validRowId) return `daily_report_order_id.eq.${validRowId}`;
  if (validRowId) {
    return `row_index.eq.${rowIndex},and(row_index.is.null,daily_report_order_id.eq.${validRowId})`;
  }
  return `row_index.eq.${rowIndex}`;
}