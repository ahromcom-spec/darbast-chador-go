import { useEffect, useRef } from 'react';

/**
 * Excel-like arrow-key navigation between input/textarea/select cells inside a <table>.
 * - ArrowUp / ArrowDown: move between rows in the same column.
 * - ArrowLeft / ArrowRight: move between columns in the same row (RTL-aware) when the
 *   text cursor is at the edge of the input/textarea, otherwise let the cursor move.
 *
 * If `containerRef.current` is provided, only fires inside that container; otherwise
 * acts globally on the document (useful for App-wide enablement).
 */
function focusableSelector() {
  return [
    'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[contenteditable="true"]',
    'button[role="combobox"]:not([disabled])',
    '[role="combobox"]:not([disabled])',
    'button[aria-haspopup="listbox"]:not([disabled])',
    'button[aria-haspopup="dialog"]:not([disabled])',
    'button[data-arrow-nav="true"]:not([disabled])',
  ].join(', ');
}

function isNavigableTarget(target: HTMLElement): boolean {
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (tag === 'button') {
    const role = target.getAttribute('role');
    const haspopup = target.getAttribute('aria-haspopup');
    if (role === 'combobox') return true;
    if (haspopup === 'listbox' || haspopup === 'dialog') return true;
    if (target.dataset.arrowNav === 'true') return true;
  }
  if (target.getAttribute('contenteditable') === 'true') return true;
  return false;
}

function isAtStart(el: HTMLInputElement | HTMLTextAreaElement) {
  return (el.selectionStart ?? 0) === 0 && (el.selectionEnd ?? 0) === 0;
}
function isAtEnd(el: HTMLInputElement | HTMLTextAreaElement) {
  const len = el.value.length;
  return (el.selectionStart ?? len) === len && (el.selectionEnd ?? len) === len;
}

function handleArrowNav(e: KeyboardEvent) {
  const key = e.key;
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;
  const tagName = target.tagName?.toLowerCase();
  if (!isNavigableTarget(target)) return;

  // If a Radix Select / combobox popover is open, let it handle arrow keys internally
  if (tagName === 'button' && target.getAttribute('aria-expanded') === 'true') return;

  // Only inside an actual table
  const cell = target.closest('td, th');
  if (!cell) return;
  const row = cell.closest('tr');
  const tableSection = row?.closest('tbody, thead, tfoot');
  const table = row?.closest('table');
  if (!row || !tableSection || !table) return;

  // RTL detection
  const rtl = getComputedStyle(table).direction === 'rtl' || !!table.closest('[dir="rtl"]');

  // Edge detection for inputs/textareas so user can still navigate inside the text
  if (tagName === 'input' || tagName === 'textarea') {
    const el = target as HTMLInputElement | HTMLTextAreaElement;
    if (key === 'ArrowLeft') {
      // In RTL visual-left == text end; in LTR visual-left == text start
      if (rtl ? !isAtEnd(el) : !isAtStart(el)) return;
    } else if (key === 'ArrowRight') {
      if (rtl ? !isAtStart(el) : !isAtEnd(el)) return;
    } else if (tagName === 'textarea' && !e.altKey) {
      const ta = el as HTMLTextAreaElement;
      if (key === 'ArrowUp' && (ta.selectionStart ?? 0) !== 0) return;
      if (key === 'ArrowDown' && (ta.selectionEnd ?? 0) !== ta.value.length) return;
    }
  }

  const rows = Array.from(tableSection.querySelectorAll(':scope > tr'));
  const rowIndex = rows.indexOf(row as HTMLTableRowElement);
  const cells = Array.from(row.querySelectorAll(':scope > td, :scope > th'));
  const colIndex = cells.indexOf(cell as HTMLTableCellElement);
  if (rowIndex < 0 || colIndex < 0) return;

  let targetCell: Element | null = null;

  const nextRowFocusable = (delta: number): Element | null => {
    let i = rowIndex + delta;
    while (i >= 0 && i < rows.length) {
      const r = rows[i];
      const rc = Array.from(r.querySelectorAll(':scope > td, :scope > th'));
      const c = rc[colIndex];
      if (c && c.querySelector(focusableSelector())) return c;
      i += delta;
    }
    return null;
  };
  const nextColFocusable = (delta: number): Element | null => {
    let i = colIndex + delta;
    while (i >= 0 && i < cells.length) {
      const c = cells[i];
      if (c.querySelector(focusableSelector())) return c;
      i += delta;
    }
    return null;
  };

  if (key === 'ArrowUp') targetCell = nextRowFocusable(-1);
  else if (key === 'ArrowDown') targetCell = nextRowFocusable(1);
  else if (key === 'ArrowRight') targetCell = nextColFocusable(rtl ? -1 : 1);
  else if (key === 'ArrowLeft') targetCell = nextColFocusable(rtl ? 1 : -1);

  if (!targetCell) return;
  const focusable = targetCell.querySelector(focusableSelector()) as HTMLElement | null;
  if (!focusable) return;
  e.preventDefault();
  e.stopPropagation();
  focusable.focus({ preventScroll: true });
  if (focusable instanceof HTMLInputElement || focusable instanceof HTMLTextAreaElement) {
    try { focusable.select(); } catch { /* noop */ }
  }
}

export function useTableArrowNavigation<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const listener = (e: Event) => handleArrowNav(e as KeyboardEvent);
    container.addEventListener('keydown', listener);
    return () => container.removeEventListener('keydown', listener);
  }, []);
  return containerRef;
}

/** Enable Excel-like arrow navigation for every <table> in the app. Call once at the root. */
export function useGlobalTableArrowNavigation() {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => handleArrowNav(e);
    document.addEventListener('keydown', listener, true);
    return () => document.removeEventListener('keydown', listener, true);
  }, []);
}
