import { useEffect, useRef } from 'react';

/**
 * Hook to enable arrow-key navigation between focusable cells in a table.
 * Attach the returned ref to a container element (e.g., a <div> wrapping the table).
 *
 * - ArrowUp / ArrowDown: move between rows in the same column
 * - ArrowLeft / ArrowRight: move between columns in the same row (respects RTL)
 */
export function useTableArrowNavigation<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getFocusableSelector = () =>
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') return;

      // For textareas, only navigate if cursor is at start/end or using Alt
      if (tagName === 'textarea' && !e.altKey) {
        const ta = target as HTMLTextAreaElement;
        if (key === 'ArrowLeft' || key === 'ArrowRight') return; // let text cursor move
        if (key === 'ArrowUp' && ta.selectionStart !== 0) return;
        if (key === 'ArrowDown' && ta.selectionEnd !== ta.value.length) return;
      }

      // Find the cell (td/th) containing this input
      const cell = target.closest('td, th');
      if (!cell) return;
      const row = cell.closest('tr');
      if (!row) return;
      const tbody = row.closest('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      const rowIndex = rows.indexOf(row as HTMLTableRowElement);
      const cells = Array.from(row.querySelectorAll('td, th'));
      const colIndex = cells.indexOf(cell as HTMLTableCellElement);

      let targetCell: Element | null = null;

      if (key === 'ArrowUp' && rowIndex > 0) {
        const targetRow = rows[rowIndex - 1];
        const targetCells = Array.from(targetRow.querySelectorAll('td, th'));
        targetCell = targetCells[colIndex] || null;
      } else if (key === 'ArrowDown' && rowIndex < rows.length - 1) {
        const targetRow = rows[rowIndex + 1];
        const targetCells = Array.from(targetRow.querySelectorAll('td, th'));
        targetCell = targetCells[colIndex] || null;
      } else if (key === 'ArrowRight') {
        // In RTL, ArrowRight means go to previous column visually (lower index)
        targetCell = cells[colIndex - 1] || null;
      } else if (key === 'ArrowLeft') {
        // In RTL, ArrowLeft means go to next column visually (higher index)
        targetCell = cells[colIndex + 1] || null;
      }

      if (targetCell) {
        const focusable = targetCell.querySelector(getFocusableSelector()) as HTMLElement | null;
        if (focusable) {
          e.preventDefault();
          focusable.focus();
          // Select all text for easy editing
          if ('select' in focusable && typeof (focusable as HTMLInputElement).select === 'function') {
            (focusable as HTMLInputElement).select();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown as EventListener);
    return () => container.removeEventListener('keydown', handleKeyDown as EventListener);
  }, []);

  return containerRef;
}
