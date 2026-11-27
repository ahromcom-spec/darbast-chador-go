/**
 * Helpers for text boxes that must never hide their content.
 *
 * Long values (order address, location description, ...) are shown clamped in
 * dense tables, so these helpers decide when a box needs an "open the full
 * text" affordance and build a short preview for tooltips.
 */

/** Values longer than this are considered cut off in a narrow table box. */
export const DEFAULT_TRUNCATABLE_CHARS = 40;

/**
 * True when the text is long enough that a clamped box cannot show it fully.
 */
export function isTextTruncated(text: string, maxChars: number = DEFAULT_TRUNCATABLE_CHARS): boolean {
  const value = (text ?? '').trim();
  return value.length > maxChars;
}

/**
 * Short single-paragraph preview of the text, cut at the last whitespace
 * before `maxChars` so words are never split in half. Ends with «…» when the
 * text was shortened.
 */
export function previewText(text: string, maxChars: number = DEFAULT_TRUNCATABLE_CHARS): string {
  const value = (text ?? '').trim();
  if (value.length <= maxChars) return value;

  const head = value.slice(0, maxChars + 1);
  const lastSpace = Math.max(head.lastIndexOf(' '), head.lastIndexOf('\n'), head.lastIndexOf('\t'));
  const cut = lastSpace > Math.floor(maxChars / 2) ? lastSpace : maxChars;
  return `${value.slice(0, cut).trimEnd()}…`;
}
