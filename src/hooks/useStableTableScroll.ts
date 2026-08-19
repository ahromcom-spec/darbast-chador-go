import { useEffect, useRef } from 'react';

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable="true"]';

/**
 * Keeps a horizontally-scrollable table fixed while an editor receives focus
 * or its controlled value is updated. Manual horizontal scrolling remains enabled.
 */
export function useStableTableScroll<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lockedScrollLeft: number | null = null;
    let restoreFrame: number | null = null;
    let restoreFollowUpFrame: number | null = null;

    const isEditable = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR));

    const restore = () => {
      if (lockedScrollLeft === null) return;
      container.scrollLeft = lockedScrollLeft;
    };

    const scheduleRestore = () => {
      restore();
      if (restoreFrame !== null) cancelAnimationFrame(restoreFrame);
      if (restoreFollowUpFrame !== null) cancelAnimationFrame(restoreFollowUpFrame);
      restoreFrame = requestAnimationFrame(() => {
        restore();
        restoreFollowUpFrame = requestAnimationFrame(restore);
      });
    };

    const rememberBeforeFocus = (event: Event) => {
      if (isEditable(event.target)) lockedScrollLeft = container.scrollLeft;
    };

    const handleFocus = (event: FocusEvent) => {
      if (!isEditable(event.target)) return;
      if (lockedScrollLeft === null) lockedScrollLeft = container.scrollLeft;
      scheduleRestore();
    };

    const handleInput = (event: Event) => {
      if (isEditable(event.target)) scheduleRestore();
    };

    const handleFocusOut = () => {
      lockedScrollLeft = null;
    };

    container.addEventListener('pointerdown', rememberBeforeFocus, true);
    container.addEventListener('keydown', rememberBeforeFocus, true);
    container.addEventListener('focusin', handleFocus, true);
    container.addEventListener('beforeinput', handleInput, true);
    container.addEventListener('input', handleInput, true);
    container.addEventListener('focusout', handleFocusOut, true);

    return () => {
      if (restoreFrame !== null) cancelAnimationFrame(restoreFrame);
      if (restoreFollowUpFrame !== null) cancelAnimationFrame(restoreFollowUpFrame);
      container.removeEventListener('pointerdown', rememberBeforeFocus, true);
      container.removeEventListener('keydown', rememberBeforeFocus, true);
      container.removeEventListener('focusin', handleFocus, true);
      container.removeEventListener('beforeinput', handleInput, true);
      container.removeEventListener('input', handleInput, true);
      container.removeEventListener('focusout', handleFocusOut, true);
    };
  }, []);

  return containerRef;
}